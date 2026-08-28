package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/ws"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// deleteAgent issues an authenticated DELETE /agents/{id} and returns the
// HTTP response.
func deleteAgent(t *testing.T, ts, agentID string) *http.Response {
	t.Helper()
	return doRequest(t, http.MethodDelete, ts+"/agents/"+agentID, map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
}

// agentReceivedClose blocks until the agent WS connection receives the given
// WS close code or times out.
func agentReceivedClose(t *testing.T, conn *ws.Conn, wantCode int) {
	t.Helper()
	// Give the server up to 3 s to deliver the close frame.
	done := make(chan struct{})
	go func() {
		defer close(done)
		conn.ReadFrame() //nolint:errcheck — we expect an error (close frame)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for close frame from server")
	}
	// CloseCode() is populated by ReadFrame when it processes a MsgClose frame.
	if code := conn.CloseCode(); code != wantCode {
		t.Errorf("close code = %d, want %d", code, wantCode)
	}
}

// ---------------------------------------------------------------------------
// DELETE /agents/{id} — HTTP contract
// ---------------------------------------------------------------------------

func TestEndSession_DeleteReturns204(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	resp := deleteAgent(t, ts, "agent-1")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("DELETE /agents/agent-1 = %d, want 204", resp.StatusCode)
	}
}

func TestEndSession_DeleteUnknownAgentReturns404AndStaysShutdown(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	_ = wsBase

	resp := deleteAgent(t, ts, "no-such-agent")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("DELETE unknown agent = %d, want 404", resp.StatusCode)
	}
	// Even on a 404, the server must be marked shutting down.
	if srv.shuttingDown.Load() == 0 {
		t.Error("server must be marked shutting_down even when agent not found")
	}
}

func TestEndSession_DeleteRequiresAuth(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	// No auth.
	resp := doRequest(t, http.MethodDelete, ts+"/agents/agent-1", nil)
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("DELETE without auth = %d, want 401", resp.StatusCode)
	}

	// Wrong password.
	resp = doRequest(t, http.MethodDelete, ts+"/agents/agent-1", map[string]string{
		"Authorization": basicHeader("admin", "wrong"),
	})
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("DELETE wrong auth = %d, want 401", resp.StatusCode)
	}

	// Agent must still be alive.
	if !srv.AgentRegistry().Has("agent-1") {
		t.Error("agent must not be disconnected by unauthenticated DELETE")
	}
}

// ---------------------------------------------------------------------------
// 4001 close frame delivery to job-agent
// ---------------------------------------------------------------------------

func TestEndSession_Delete_Sends4001ToAgent(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("DELETE = %d, want 204", resp.StatusCode)
	}

	// The agent control connection must receive WS close 4001.
	agentReceivedClose(t, agentConn, closeCodeAgentTerminated)
}

func TestEndSession_Delete_Sends4001_AgentDropsAfterClose(t *testing.T) {
	// Full lifecycle: agent connects, DELETE is issued, agent gets 4001 and
	// its read loop exits, Unregister is called, registry is empty.
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	// Agent receives 4001 and closes its connection (simulating job-agent
	// shutting down after errTerminated).
	agentReceivedClose(t, agentConn, closeCodeAgentTerminated)
	agentConn.Close()

	// Registry must empty out.
	deadline := time.Now().Add(2 * time.Second)
	for srv.AgentRegistry().Has("agent-1") && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if srv.AgentRegistry().Has("agent-1") {
		t.Error("agent must be unregistered after control connection closes")
	}
	if srv.AgentRegistry().Count() != 0 {
		t.Errorf("registry count = %d, want 0", srv.AgentRegistry().Count())
	}
}

func TestEndSession_Delete_4001SentBeforeWaitAgentsDoneReturns(t *testing.T) {
	// This is the regression test for the original bug: WaitAgentsDone must
	// not return until the 4001 close frame has been sent.
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")

	// The "agent" is a goroutine that records the close code it receives.
	receivedClose := make(chan int, 1)
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	go func() {
		defer agentConn.Close()
		_, err := agentConn.ReadFrame()
		if err != nil && ws.IsCloseError(agentConn, err, closeCodeAgentTerminated) {
			receivedClose <- agentConn.CloseCode()
		} else if err == io.EOF {
			receivedClose <- agentConn.CloseCode()
		} else {
			receivedClose <- -1
		}
	}()
	waitAgentReady(t, ts, "agent-1")

	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	// WaitAgentsDone must block until the handleAgentWS goroutine has returned
	// (meaning the 4001 frame was sent and conn.Close() was called).
	done := make(chan struct{})
	go func() {
		srv.WaitAgentsDone()
		close(done)
	}()

	select {
	case <-done:
		// Good — WaitAgentsDone returned.
	case <-time.After(3 * time.Second):
		t.Fatal("WaitAgentsDone did not return within 3s after DELETE")
	}

	// The close code the agent received must be 4001.
	select {
	case code := <-receivedClose:
		if code != closeCodeAgentTerminated {
			t.Errorf("agent received close code %d, want %d", code, closeCodeAgentTerminated)
		}
	case <-time.After(time.Second):
		t.Error("agent never received a close frame")
	}
}

// ---------------------------------------------------------------------------
// ShutdownCh behaviour
// ---------------------------------------------------------------------------

func TestEndSession_ShutdownChClosedByDelete(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	// ShutdownCh must be open before DELETE.
	select {
	case <-srv.ShutdownCh():
		t.Fatal("ShutdownCh must be open before DELETE is called")
	default:
	}

	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	select {
	case <-srv.ShutdownCh():
		// Closed immediately after DELETE.
	case <-time.After(2 * time.Second):
		t.Fatal("ShutdownCh was not closed within 2s after DELETE /agents/agent-1")
	}
}

func TestEndSession_ShutdownChClosedByIdleDisconnect(t *testing.T) {
	// Simulates idle timeout: agent control connection drops naturally →
	// onEmpty → MarkShuttingDown → ShutdownCh closed.
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	_ = ts

	fired := make(chan struct{})
	srv.AgentRegistry().SetOnEmpty(func() {
		srv.MarkShuttingDown()
		close(fired)
	})

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})

	// Closing the connection simulates idle-timeout agent exit.
	agentConn.Close()

	select {
	case <-fired:
	case <-time.After(2 * time.Second):
		t.Fatal("onEmpty callback not fired within 2s after connection close")
	}

	select {
	case <-srv.ShutdownCh():
		// Correct.
	case <-time.After(time.Second):
		t.Fatal("ShutdownCh not closed after MarkShuttingDown from onEmpty")
	}
}

func TestEndSession_MarkShuttingDown_Idempotent(t *testing.T) {
	srv, _ := newWSServer(t, "test-password", testRunKey())

	// Multiple calls must not panic (shutdownOnce.Do guarantees this).
	for i := 0; i < 10; i++ {
		srv.MarkShuttingDown()
	}

	// Channel must be closed (readable) after any call.
	select {
	case <-srv.ShutdownCh():
	default:
		t.Error("ShutdownCh must be closed after MarkShuttingDown")
	}
}

func TestEndSession_ShutdownCh_OpenOnFreshServer(t *testing.T) {
	srv, _ := newWSServer(t, "test-password", testRunKey())

	select {
	case <-srv.ShutdownCh():
		t.Error("ShutdownCh must be open on a fresh server")
	default:
		// Correct.
	}
}

// ---------------------------------------------------------------------------
// Login / browser-WS blocked after End Session
// ---------------------------------------------------------------------------

func TestEndSession_LoginBlockedAfterDelete(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	// Login after DELETE must return 503 shutting_down.
	loginResp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	defer loginResp.Body.Close()
	if loginResp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("login after DELETE = %d, want 503", loginResp.StatusCode)
	}
	var body map[string]interface{}
	if err := json.NewDecoder(loginResp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["error"] != "shutting_down" {
		t.Errorf("error = %v, want shutting_down", body["error"])
	}
}

func TestEndSession_BrowserWSBlockedAfterDelete(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	// Get a WS token before DELETE.
	token := issueWSToken(t, ts)

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	// Even with a previously-issued token, /ws/browser must be rejected.
	_, dialResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("browser WS must be rejected after DELETE")
	}
	if dialResp == nil || dialResp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("browser WS after DELETE = %v, want 503", dialResp)
	}
}

func TestEndSession_GetAgentByID_Returns503AfterDelete(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	// Probe endpoint must return 503, not 200 or 404.
	probe := doRequest(t, http.MethodGet, ts+"/agents/agent-1", nil)
	defer probe.Body.Close()
	if probe.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("GET /agents/agent-1 after DELETE = %d, want 503", probe.StatusCode)
	}
}

// ---------------------------------------------------------------------------
// agentWG — concurrent handler tracking
// ---------------------------------------------------------------------------

func TestEndSession_WaitAgentsDone_NoAgentsReturnsImmediately(t *testing.T) {
	srv, _ := newWSServer(t, "test-password", testRunKey())

	done := make(chan struct{})
	go func() {
		srv.WaitAgentsDone()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("WaitAgentsDone should return immediately when no agents are connected")
	}
}

func TestEndSession_WaitAgentsDone_BlocksUntilAllHandlersExit(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	const n = 3
	conns := make([]*ws.Conn, n)
	for i := 0; i < n; i++ {
		agentID := strings.Repeat("a", i+1) // "a", "aa", "aaa"
		runToken := issueRunToken(t, ts, agentID)
		conns[i] = registerTestAgent(t, wsBase, runToken, agentID, []Service{{Name: "ttyd"}})
		waitAgentReady(t, ts, agentID)
	}

	// WaitAgentsDone must block while all agents are still connected.
	waitDone := make(chan struct{})
	go func() {
		srv.WaitAgentsDone()
		close(waitDone)
	}()

	select {
	case <-waitDone:
		t.Fatal("WaitAgentsDone must block while agents are still connected")
	case <-time.After(100 * time.Millisecond):
		// Still blocking — correct.
	}

	// Close all connections; WaitAgentsDone must unblock.
	for _, c := range conns {
		c.Close()
	}
	select {
	case <-waitDone:
		// Correct.
	case <-time.After(3 * time.Second):
		t.Fatal("WaitAgentsDone did not unblock within 3s after all connections closed")
	}
}

// ---------------------------------------------------------------------------
// Full End Session relay teardown — browser gets close code 4000
// ---------------------------------------------------------------------------

func TestEndSession_BrowserReceivesClose4000(t *testing.T) {
	// The full End Session path:
	//   browser connected → DELETE /agents/{id} →
	//   agent receives 4001 → agent shuts down relay →
	//   browser receives 4000 (closeCodeAgentGone from relayToBrowser).
	//
	// Note: in this test the "agent" is our test code, not the real job-agent
	// daemon. We manually simulate what the daemon does when it receives 4001:
	// close the relay WS connection (which causes relayToBrowser to send 4000
	// to the browser).
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	// Use registerTestAgent (not startTestAgent / setupRelay) so no competing
	// goroutine reads from agentConn — we need to read the 4001 frame ourselves.
	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()

	// Drive the agent control connection: forward control messages to a channel
	// so establishRelay can consume the relay-open message.
	msgs := make(chan agentControlMsg, 32)
	go func() {
		for {
			f, err := agentConn.ReadFrame()
			if err != nil {
				return
			}
			var ctrl struct {
				Type       string `json:"type"`
				RelayID    string `json:"relay_id"`
				Service    string `json:"service"`
				RelayToken string `json:"relay_token"`
			}
			if err := json.Unmarshal(f.Payload, &ctrl); err != nil {
				continue
			}
			msgs <- agentControlMsg{
				Type:       ctrl.Type,
				RelayID:    ctrl.RelayID,
				Service:    ctrl.Service,
				RelayToken: ctrl.RelayToken,
			}
		}
	}()

	waitAgentReady(t, ts, "agent-1")

	// Establish a live relay so the browser is actively connected.
	browser, open := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()
	_ = open

	// Confirm the relay is live with a round-trip.
	if err := browser.WriteFrame(ws.MsgText, []byte("ping")); err != nil {
		t.Fatalf("pre-DELETE write: %v", err)
	}
	f, err := browser.ReadFrame()
	if err != nil || string(f.Payload) != "ping" {
		t.Fatalf("pre-DELETE round-trip: err=%v payload=%q", err, f.Payload)
	}

	// DELETE the agent — this marks shuttingDown and sends 4001 to agentConn.
	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	// The browser must receive close code 4000 (agent gone). relayToBrowser
	// sends the close frame when the relay (agent) side disconnects.
	done := make(chan struct{})
	go func() {
		defer close(done)
		browser.ReadFrame() //nolint:errcheck — expecting a close frame
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("browser did not receive close frame within 5s")
	}
	if code := browser.CloseCode(); code != closeCodeAgentGone {
		t.Errorf("browser close code = %d, want %d (closeCodeAgentGone)", code, closeCodeAgentGone)
	}
}

func TestEndSession_BrowserReceivesClose4000_NoBrowserConnected(t *testing.T) {
	// DELETE with no active browser relay must still deliver 4001 to the agent
	// and ShutdownCh must close. No browser, so no 4000 to check.
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	// No browser relay established.
	resp := deleteAgent(t, ts, "agent-1")
	resp.Body.Close()

	// Agent gets 4001.
	agentReceivedClose(t, agentConn, closeCodeAgentTerminated)

	// ShutdownCh is closed.
	select {
	case <-srv.ShutdownCh():
	case <-time.After(2 * time.Second):
		t.Fatal("ShutdownCh not closed after DELETE with no active relay")
	}
}

// ---------------------------------------------------------------------------
// Concurrent End Session safety
// ---------------------------------------------------------------------------

func TestEndSession_ConcurrentDeleteIdempotent(t *testing.T) {
	// Multiple concurrent DELETE requests for the same agent must not panic,
	// must not double-close terminateCh, and the agent must receive exactly
	// one 4001 close frame.
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	runToken := issueRunToken(t, ts, "agent-1")
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()
	waitAgentReady(t, ts, "agent-1")

	const n = 5
	var wg sync.WaitGroup
	statuses := make([]int, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			resp := deleteAgent(t, ts, "agent-1")
			resp.Body.Close()
			statuses[i] = resp.StatusCode
		}(i)
	}
	wg.Wait()

	// Exactly one 204, the rest 404 (or all mixed — the critical thing is no
	// panic, no double-close, and server marked shutting down).
	found204 := 0
	for _, s := range statuses {
		if s == http.StatusNoContent {
			found204++
		}
		if s != http.StatusNoContent && s != http.StatusNotFound {
			t.Errorf("unexpected status %d (want 204 or 404)", s)
		}
	}
	if found204 != 1 {
		t.Errorf("exactly one DELETE should succeed with 204, got %d", found204)
	}

	// Server is in shutting-down state.
	if srv.shuttingDown.Load() == 0 {
		t.Error("server must be in shutting-down state after DELETE")
	}

	// ShutdownCh is closed.
	select {
	case <-srv.ShutdownCh():
	case <-time.After(2 * time.Second):
		t.Fatal("ShutdownCh not closed after concurrent DELETEs")
	}

	// Agent receives exactly one 4001 frame (not a panic from double-close).
	agentReceivedClose(t, agentConn, closeCodeAgentTerminated)
}

func TestEndSession_MultipleAgents_AllGet4001(t *testing.T) {
	// When multiple agents are registered and the last one is deleted,
	// each deleted agent gets its 4001 close frame.
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	agentIDs := []string{"alpha", "beta", "gamma"}
	conns := make(map[string]*ws.Conn)
	for _, id := range agentIDs {
		runToken := issueRunToken(t, ts, id)
		conns[id] = registerTestAgent(t, wsBase, runToken, id, []Service{{Name: "ttyd"}})
		waitAgentReady(t, ts, id)
	}
	defer func() {
		for _, c := range conns {
			c.Close()
		}
	}()

	// Delete all agents; each should receive 4001.
	for _, id := range agentIDs {
		resp := deleteAgent(t, ts, id)
		resp.Body.Close()
		agentReceivedClose(t, conns[id], closeCodeAgentTerminated)
	}

	// After all agents are gone, ShutdownCh must be closed.
	select {
	case <-srv.ShutdownCh():
	case <-time.After(2 * time.Second):
		t.Fatal("ShutdownCh not closed after all agents deleted")
	}
	if srv.AgentRegistry().Count() != 0 {
		t.Errorf("registry count = %d after all agents deleted, want 0", srv.AgentRegistry().Count())
	}
}
