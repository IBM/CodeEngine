package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/ws"
)

// nowPlus returns a time d in the future.
func nowPlus(d time.Duration) time.Time {
	return time.Now().Add(d)
}

// timeoutChan returns a channel that fires after 2 seconds.
func timeoutChan() <-chan time.Time {
	return time.After(2 * time.Second)
}

// newTestWSConn creates a real *ws.Conn backed by an httptest server
// that reads until the connection closes. The returned conn is cleaned up
// automatically. A background goroutine drains the conn so that Done() fires
// when the server side closes the connection.
func newTestWSConn(t *testing.T) *ws.Conn {
	t.Helper()
	ready := make(chan struct{})
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := ws.Upgrade(w, r)
		if err != nil {
			return
		}
		close(ready)
		defer conn.Close()
		for {
			if _, err := conn.ReadFrame(); err != nil {
				return
			}
		}
	}))
	t.Cleanup(ts.Close)

	url := "ws" + strings.TrimPrefix(ts.URL, "http")
	conn, err := ws.Dial(url)
	if err != nil {
		t.Fatalf("dial test WS: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	// Run a background reader so Done() fires when the server closes the TCP conn.
	go func() {
		for {
			if _, err := conn.ReadFrame(); err != nil {
				return
			}
		}
	}()
	// Wait for server side to be ready
	select {
	case <-ready:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server-side WS upgrade")
	}
	return conn
}

// waitConnClosed waits until the connection's Done channel fires (i.e. it is closed).
func waitConnClosed(t *testing.T, conn *ws.Conn) {
	t.Helper()
	select {
	case <-conn.Done():
	case <-timeoutChan():
		t.Fatal("timed out waiting for connection close")
	}
}

func TestAgentRegistry_RegisterAndList(t *testing.T) {
	reg := NewAgentRegistry()
	conn := newTestWSConn(t)

	reg.Register("agent-1", conn)
	reg.SetServices("agent-1", []Service{{Name: "ttyd", Upstream: "ws://127.0.0.1:7080"}})

	if !reg.Has("agent-1") {
		t.Fatal("agent should be registered")
	}
	if !reg.HasService("agent-1", "ttyd") {
		t.Error("agent should offer service ttyd")
	}
	if reg.HasService("agent-1", "nope") {
		t.Error("agent should not offer unregistered service")
	}

	infos := reg.List()
	if len(infos) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(infos))
	}
	if infos[0].AgentID != "agent-1" {
		t.Errorf("agent_id = %q", infos[0].AgentID)
	}
	if infos[0].Status != "ready" {
		t.Errorf("status = %q, want ready", infos[0].Status)
	}
	if len(infos[0].Services) != 1 || infos[0].Services[0] != "ttyd" {
		t.Errorf("services = %v, want [ttyd]", infos[0].Services)
	}
	if infos[0].RegisteredAt.IsZero() {
		t.Error("registered_at should be set")
	}
}

func TestAgentRegistry_MultiAgent(t *testing.T) {
	reg := NewAgentRegistry()
	reg.Register("agent-A", newTestWSConn(t))
	reg.Register("agent-B", newTestWSConn(t))
	reg.SetServices("agent-A", []Service{{Name: "ttyd"}})
	reg.SetServices("agent-B", []Service{{Name: "ttyd"}})

	if reg.Count() != 2 {
		t.Fatalf("expected 2 agents, got %d", reg.Count())
	}
	infos := reg.List()
	if len(infos) != 2 {
		t.Fatalf("expected 2 entries in List, got %d", len(infos))
	}
}

func TestAgentRegistry_ReplacementClosesOldConn(t *testing.T) {
	reg := NewAgentRegistry()
	conn1 := newTestWSConn(t)
	conn2 := newTestWSConn(t)

	reg.Register("agent-1", conn1)
	reg.Register("agent-1", conn2)

	// The old connection must be closed by the registry — Done() fires.
	select {
	case <-conn1.Done():
		// expected
	case <-time.After(2 * time.Second):
		t.Error("replaced connection should be closed")
	}
	if reg.Count() != 1 {
		t.Errorf("expected 1 entry after replacement, got %d", reg.Count())
	}
}

func TestAgentRegistry_UnregisterOnlyCurrentConn(t *testing.T) {
	reg := NewAgentRegistry()
	conn1 := newTestWSConn(t)
	conn2 := newTestWSConn(t)

	reg.Register("agent-1", conn1)
	reg.Register("agent-1", conn2)

	// A stale handler for conn1 must not remove the new entry.
	reg.Unregister("agent-1", conn1)
	if !reg.Has("agent-1") {
		t.Error("stale unregister must not remove the current entry")
	}

	// The current handler unregisters properly.
	reg.Unregister("agent-1", conn2)
	if reg.Has("agent-1") {
		t.Error("agent should be unregistered")
	}
}

func TestAgentRegistry_ReRegisterReplacesServices(t *testing.T) {
	reg := NewAgentRegistry()
	reg.Register("agent-1", newTestWSConn(t))
	reg.SetServices("agent-1", []Service{{Name: "ttyd"}})

	if !reg.HasService("agent-1", "ttyd") {
		t.Fatal("ttyd should be registered")
	}

	// Re-register with a different service set: the old service is gone.
	reg.SetServices("agent-1", []Service{{Name: "openclaw"}})
	if reg.HasService("agent-1", "ttyd") {
		t.Error("removed service should no longer be connectable")
	}
	if !reg.HasService("agent-1", "openclaw") {
		t.Error("newly added service should be connectable")
	}
}

func TestAgentRegistry_ConcurrentRegister(t *testing.T) {
	reg := NewAgentRegistry()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			reg.Register("agent-"+string(rune('A'+i%5)), newTestWSConn(t))
		}(i)
	}
	wg.Wait()

	if reg.Count() != 5 {
		t.Errorf("expected 5 distinct agents, got %d", reg.Count())
	}
}

func TestAgentRegistry_CloseClosesAll(t *testing.T) {
	reg := NewAgentRegistry()
	conn1 := newTestWSConn(t)
	conn2 := newTestWSConn(t)
	reg.Register("agent-1", conn1)
	reg.Register("agent-2", conn2)

	reg.Close()

	select {
	case <-conn1.Done():
	case <-time.After(2 * time.Second):
		t.Error("Close should close conn1")
	}
	select {
	case <-conn2.Done():
	case <-time.After(2 * time.Second):
		t.Error("Close should close conn2")
	}
	if reg.Count() != 0 {
		t.Errorf("expected 0 after Close, got %d", reg.Count())
	}
}

func TestAgentRegistry_GetReturnsConn(t *testing.T) {
	reg := NewAgentRegistry()
	conn := newTestWSConn(t)
	reg.Register("agent-1", conn)

	if reg.Get("agent-1") != conn {
		t.Error("Get should return the registered connection")
	}
	if reg.Get("missing") != nil {
		t.Error("Get should return nil for unknown agent")
	}
}

<<<<<<< Updated upstream
func TestAgentRegistry_OnEmpty_FiredOnUnregister(t *testing.T) {
	reg := NewAgentRegistry()
	fired := make(chan struct{}, 1)
	reg.SetOnEmpty(func() { fired <- struct{}{} })

	conn := newTestWSConn(t)
	reg.Register("agent-1", conn)
	reg.Unregister("agent-1", conn)

	select {
	case <-fired:
	case <-timeoutChan():
		t.Fatal("onEmpty not called after last agent unregistered")
	}
}

func TestAgentRegistry_OnEmpty_FiredOnDisconnect(t *testing.T) {
	reg := NewAgentRegistry()
	fired := make(chan struct{}, 1)
	reg.SetOnEmpty(func() { fired <- struct{}{} })

	conn := newTestWSConn(t)
	reg.Register("agent-1", conn)
	reg.Disconnect("agent-1")

	select {
	case <-fired:
	case <-timeoutChan():
		t.Fatal("onEmpty not called after Disconnect")
	}
}

func TestAgentRegistry_OnEmpty_NotFiredBeforeAnyAgent(t *testing.T) {
	reg := NewAgentRegistry()
	fired := make(chan struct{}, 1)
	reg.SetOnEmpty(func() { fired <- struct{}{} })

	// No agents ever registered — callback must never fire.
	select {
	case <-fired:
		t.Fatal("onEmpty must not fire when no agent ever registered")
	case <-time.After(100 * time.Millisecond):
	}
}

func TestAgentRegistry_OnEmpty_NotFiredWhenAgentsRemain(t *testing.T) {
	reg := NewAgentRegistry()
	fired := make(chan struct{}, 1)
	reg.SetOnEmpty(func() { fired <- struct{}{} })

	conn1 := newTestWSConn(t)
	conn2 := newTestWSConn(t)
	reg.Register("agent-1", conn1)
	reg.Register("agent-2", conn2)
	reg.Unregister("agent-1", conn1) // one still registered

	select {
	case <-fired:
		t.Fatal("onEmpty must not fire while agent-2 is still registered")
	case <-time.After(100 * time.Millisecond):
	}
}

func TestAgentRegistry_OnEmpty_FiredOnceOnly(t *testing.T) {
	reg := NewAgentRegistry()
	count := 0
	var mu sync.Mutex
	reg.SetOnEmpty(func() {
		mu.Lock()
		count++
		mu.Unlock()
	})

	conn := newTestWSConn(t)
	reg.Register("agent-1", conn)
	reg.Unregister("agent-1", conn)
	time.Sleep(50 * time.Millisecond)

	// Register and unregister a second agent — callback must not fire again.
	conn2 := newTestWSConn(t)
	reg.Register("agent-2", conn2)
	reg.Unregister("agent-2", conn2)
	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()
	if count != 1 {
		t.Errorf("onEmpty fired %d times, want exactly 1", count)
	}
}
=======
// suppress unused import
var _ = nowPlus
>>>>>>> Stashed changes
