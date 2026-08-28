package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/ws"
)

// newEchoConn returns a *ws.Conn backed by an httptest echo server.
func newEchoConn(t *testing.T) *ws.Conn {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := ws.Upgrade(w, r)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			f, err := conn.ReadFrame()
			if err != nil {
				return
			}
			if err := conn.WriteFrame(f.MessageType, f.Payload); err != nil {
				return
			}
		}
	}))
	t.Cleanup(ts.Close)
	url := "ws" + strings.TrimPrefix(ts.URL, "http")
	conn, err := ws.Dial(url)
	if err != nil {
		t.Fatalf("dial echo conn: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func TestRelayManager_CreateAttachClose(t *testing.T) {
	m := newRelayManager(nil)
	browser := newEchoConn(t)
	relay := newEchoConn(t)
	control := newEchoConn(t)

	token := "relay-token-1"
	e, err := m.create("agent-1", "ttyd", browser, token, control)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if e.id == "" {
		t.Fatal("relay id must be non-empty")
	}
	if !m.hasToken(token) {
		t.Fatal("token should be tracked")
	}
	if m.count() != 1 {
		t.Fatalf("count = %d, want 1", m.count())
	}

	// Attach the agent relay connection.
	attached, ok := m.attach(token, relay)
	if !ok {
		t.Fatal("attach should succeed for a live relay")
	}
	if attached != e {
		t.Error("attach should return the same entry")
	}

	// Close by id.
	m.close(e.id)
	if m.count() != 0 {
		t.Errorf("count after close = %d, want 0", m.count())
	}
	if m.hasToken(token) {
		t.Error("token should be released after close")
	}
	// Closing again is a no-op.
	m.close(e.id)
}

func TestRelayManager_AttachUnknownToken(t *testing.T) {
	m := newRelayManager(nil)
	relay := newEchoConn(t)

	if _, ok := m.attach("no-such-token", relay); ok {
		t.Fatal("attach with unknown token must fail")
	}
}

func TestRelayManager_CloseAgentTearsDownItsRelays(t *testing.T) {
	m := newRelayManager(nil)
	control1 := newEchoConn(t)
	control2 := newEchoConn(t)

	e1, _ := m.create("agent-1", "ttyd", newEchoConn(t), "t1", control1)
	e2, _ := m.create("agent-1", "ttyd", newEchoConn(t), "t2", control1)
	e3, _ := m.create("agent-2", "ttyd", newEchoConn(t), "t3", control2)

	m.closeAgent("agent-1", control1)

	if m.count() != 1 {
		t.Errorf("count = %d, want 1 (agent-2 relay only)", m.count())
	}
	if m.hasToken("t1") || m.hasToken("t2") {
		t.Error("agent-1 relay tokens must be released")
	}
	if !m.hasToken("t3") {
		t.Error("agent-2 relay must be untouched")
	}
	_ = e1
	_ = e2
	_ = e3
}

func TestRelayManager_CloseAll(t *testing.T) {
	m := newRelayManager(nil)
	m.create("agent-1", "ttyd", newEchoConn(t), "t1", newEchoConn(t))
	m.create("agent-2", "ttyd", newEchoConn(t), "t2", newEchoConn(t))

	m.closeAll()
	if m.count() != 0 {
		t.Errorf("count after closeAll = %d, want 0", m.count())
	}
}

func TestRelayManager_SendControlSerialized(t *testing.T) {
	m := newRelayManager(nil)
	control := newEchoConn(t)

	// Concurrent control writes must not corrupt the connection.
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			msg := map[string]interface{}{
				"type":        "relay-open",
				"relay_id":    "id",
				"service":     "ttyd",
				"relay_token": "token",
			}
			if err := m.sendControl(control, msg); err != nil {
				t.Errorf("sendControl: %v", err)
			}
		}(i)
	}
	wg.Wait()

	// The echo server should have received all 20 messages intact.
	for i := 0; i < 20; i++ {
		f, err := control.ReadFrame()
		if err != nil {
			t.Fatalf("read echoed control message: %v", err)
		}
		var got map[string]interface{}
		if err := json.Unmarshal(f.Payload, &got); err != nil {
			t.Fatalf("echoed message is not valid JSON: %v", err)
		}
		if got["type"] != "relay-open" {
			t.Errorf("echoed type = %v", got["type"])
		}
	}
}

func TestRelayManager_SendControlNilConn(t *testing.T) {
	m := newRelayManager(nil)
	if err := m.sendControl(nil, map[string]interface{}{"type": "relay-open"}); err == nil {
		t.Fatal("sendControl on nil connection must error")
	}
}

func TestRelayManager_TeardownClosesBothEnds(t *testing.T) {
	m := newRelayManager(nil)
	browser := newEchoConn(t)
	relay := newEchoConn(t)

	e, _ := m.create("agent-1", "ttyd", browser, "t1", newEchoConn(t))
	m.attach("t1", relay)

	m.close(e.id)

	// Both ends must be closed (Done fires).
	select {
	case <-browser.Done():
	case <-time.After(2 * time.Second):
		t.Error("browser conn should be closed after teardown")
	}
	select {
	case <-relay.Done():
	case <-time.After(2 * time.Second):
		t.Error("relay conn should be closed after teardown")
	}
}
