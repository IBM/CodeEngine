package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/ws"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// newWSServerWithTimeout builds a WS server with a custom relay-open timeout.
func newWSServerWithTimeout(t *testing.T, relayOpenTimeout time.Duration) (*Server, string) {
	t.Helper()
	srv := NewServer(Config{
		GatewayPassword:  "test-password",
		RunTokenKey:      testRunKey(),
		RelayOpenTimeout: relayOpenTimeout,
	})
	t.Cleanup(srv.Shutdown)

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)
	ts := httptest.NewServer(mux)
	t.Cleanup(ts.Close)
	return srv, "ws" + strings.TrimPrefix(ts.URL, "http")
}

// echoUpstream starts a WS echo server that prefixes each echoed payload with
// the given prefix ("" for a plain echo). It returns the ws:// URL.
func echoUpstream(t *testing.T, prefix string) string {
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
			payload := f.Payload
			if prefix != "" {
				payload = append([]byte(prefix), f.Payload...)
			}
			if err := conn.WriteFrame(f.MessageType, payload); err != nil {
				return
			}
		}
	}))
	t.Cleanup(ts.Close)
	return "ws" + strings.TrimPrefix(ts.URL, "http")
}

// agentControlMsg is a control message received by the test agent.
type agentControlMsg struct {
	Type       string
	RelayID    string
	Service    string
	RelayToken string
}

// startTestAgent registers an agent and runs a goroutine that forwards every
// control message to the returned channel.
func startTestAgent(t *testing.T, wsBase, runToken, agentID string, services []Service) (*ws.Conn, chan agentControlMsg) {
	t.Helper()
	conn := registerTestAgent(t, wsBase, runToken, agentID, services)
	msgs := make(chan agentControlMsg, 32)
	go func() {
		for {
			f, err := conn.ReadFrame()
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
			msgs <- agentControlMsg{Type: ctrl.Type, RelayID: ctrl.RelayID, Service: ctrl.Service, RelayToken: ctrl.RelayToken}
		}
	}()
	return conn, msgs
}

// waitControl waits for a control message of the given type.
func waitControl(t *testing.T, msgs chan agentControlMsg, typ string) agentControlMsg {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		select {
		case m := <-msgs:
			if m.Type == typ {
				return m
			}
		case <-deadline:
			t.Fatalf("timed out waiting for control message %q", typ)
		}
	}
}

// dialRelay dials /ws/relay with a one-time relay token.
func dialRelay(t *testing.T, wsBase, relayToken string) *ws.Conn {
	t.Helper()
	conn, resp, err := dialWS(t, wsBase+"/ws/relay?relayToken="+relayToken, nil)
	if err != nil {
		t.Fatalf("relay dial failed: %v (resp %v)", err, resp)
	}
	return conn
}

// pipeConns pipes frames between two connections in both directions until
// either side closes.
func pipeConns(a, b *ws.Conn) {
	go func() {
		for {
			f, err := a.ReadFrame()
			if err != nil {
				b.Close()
				return
			}
			if err := b.WriteFrame(f.MessageType, f.Payload); err != nil {
				a.Close()
				return
			}
		}
	}()
	go func() {
		for {
			f, err := b.ReadFrame()
			if err != nil {
				a.Close()
				return
			}
			if err := a.WriteFrame(f.MessageType, f.Payload); err != nil {
				b.Close()
				return
			}
		}
	}()
}

// issueWSToken logs in and returns a fresh WS token.
func issueWSToken(t *testing.T, ts string) string {
	t.Helper()
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	token, _ := body["token"].(string)
	if token == "" {
		t.Fatal("no WS token issued")
	}
	return token
}

// issueRunToken issues a run token for the given agent.
func issueRunToken(t *testing.T, ts, agentID string) string {
	t.Helper()
	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent="+agentID, map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	token, _ := body["run_token"].(string)
	if token == "" {
		t.Fatal("no run token issued")
	}
	return token
}

// connectBrowser dials /ws/browser and returns the connection.
func connectBrowser(t *testing.T, wsBase, token, agentID, service string) *ws.Conn {
	t.Helper()
	conn, resp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent="+agentID+"&service="+service, nil)
	if err != nil {
		t.Fatalf("browser dial failed: %v (resp %v)", err, resp)
	}
	return conn
}

// waitAgentReady polls GET /agents until the agent is listed with services.
func waitAgentReady(t *testing.T, ts, agentID string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for {
		resp := doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
			"Authorization": basicHeader("admin", "test-password"),
		})
		var agents []AgentInfo
		_ = json.NewDecoder(resp.Body).Decode(&agents)
		resp.Body.Close()
		for _, a := range agents {
			if a.AgentID == agentID && len(a.Services) > 0 {
				return
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("agent %s did not become ready in time", agentID)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// setupRelay registers an agent with an echo upstream and returns the pieces
// needed to drive a browser relay session.
func setupRelay(t *testing.T, wsBase, ts, agentID string, services []Service, upstreamURL string) (*ws.Conn, chan agentControlMsg) {
	t.Helper()
	runToken := issueRunToken(t, ts, agentID)
	agentConn, msgs := startTestAgent(t, wsBase, runToken, agentID, services)
	waitAgentReady(t, ts, agentID)
	return agentConn, msgs
}

// establishRelay connects a browser, waits for relay-open, dials the relay,
// and pipes it to the echo upstream. It returns the browser connection and
// the relay-open control message.
func establishRelay(t *testing.T, wsBase, ts, agentID, service, upstreamURL string, msgs chan agentControlMsg) (*ws.Conn, agentControlMsg) {
	t.Helper()
	token := issueWSToken(t, ts)
	browser := connectBrowser(t, wsBase, token, agentID, service)
	open := waitControl(t, msgs, "relay-open")
	if open.Service != service {
		t.Fatalf("relay-open service = %q, want %q", open.Service, service)
	}
	relayConn := dialRelay(t, wsBase, open.RelayToken)
	upstream, _, err := dialWS(t, upstreamURL, nil)
	if err != nil {
		t.Fatalf("upstream dial failed: %v", err)
	}
	pipeConns(relayConn, upstream)
	return browser, open
}

// waitRelayCount polls until the relay manager has exactly want active
// relays (teardown is asynchronous).
func waitRelayCount(t *testing.T, srv *Server, want int) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for srv.relays.count() != want && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if n := srv.relays.count(); n != want {
		t.Errorf("expected %d active relays, got %d", want, n)
	}
}

// waitConnDone waits until conn is closed (either Done fires or a read returns an error).
// It starts a background reader to detect the close in case no other goroutine is reading.
func waitConnDone(t *testing.T, conn *ws.Conn, msg string) {
	t.Helper()
	// Kick off a background reader so that Done() fires when the underlying
	// TCP connection is closed by the server side.
	go func() {
		for {
			if _, err := conn.ReadFrame(); err != nil {
				return
			}
		}
	}()
	select {
	case <-conn.Done():
	case <-time.After(3 * time.Second):
		t.Fatalf("timed out: %s", msg)
	}
}

// ---------------------------------------------------------------------------
// Opaque forwarding
// ---------------------------------------------------------------------------

func TestRelay_TextRoundTripByteIdentical(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()

	payload := []byte("hello opaque relay — text frame")
	if err := browser.WriteFrame(ws.MsgText, payload); err != nil {
		t.Fatalf("browser write: %v", err)
	}
	f, err := browser.ReadFrame()
	if err != nil {
		t.Fatalf("browser read: %v", err)
	}
	if f.MessageType != ws.MsgText {
		t.Errorf("opcode = %d, want text (%d)", f.MessageType, ws.MsgText)
	}
	if string(f.Payload) != string(payload) {
		t.Errorf("payload mismatch: got %q, want %q", f.Payload, payload)
	}
}

func TestRelay_BinaryRoundTripByteIdentical(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()

	payload := []byte{0x00, 0x01, 0x02, 0xFF, 0xFE, 0x80, 0x7F, 0x00, 0x10, 0x20}
	if err := browser.WriteFrame(ws.MsgBinary, payload); err != nil {
		t.Fatalf("browser write: %v", err)
	}
	f, err := browser.ReadFrame()
	if err != nil {
		t.Fatalf("browser read: %v", err)
	}
	if f.MessageType != ws.MsgBinary {
		t.Errorf("opcode = %d, want binary (%d)", f.MessageType, ws.MsgBinary)
	}
	if len(f.Payload) != len(payload) {
		t.Fatalf("payload length = %d, want %d", len(f.Payload), len(payload))
	}
	for i := range payload {
		if f.Payload[i] != payload[i] {
			t.Errorf("byte %d = %#x, want %#x", i, f.Payload[i], payload[i])
		}
	}
}

func TestRelay_LargeFrameRoundTrip(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()

	// >64KB frame (default WS read limit territory).
	payload := make([]byte, 256*1024)
	for i := range payload {
		payload[i] = byte(i % 251)
	}
	if err := browser.WriteFrame(ws.MsgBinary, payload); err != nil {
		t.Fatalf("browser write: %v", err)
	}
	f, err := browser.ReadFrame()
	if err != nil {
		t.Fatalf("browser read: %v", err)
	}
	if f.MessageType != ws.MsgBinary {
		t.Errorf("opcode = %d, want binary", f.MessageType)
	}
	if len(f.Payload) != len(payload) {
		t.Fatalf("large frame length = %d, want %d", len(f.Payload), len(payload))
	}
	for i := range payload {
		if f.Payload[i] != payload[i] {
			t.Fatalf("large frame byte %d mismatch", i)
		}
	}
}

func TestRelay_OrderPreserved(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()

	const n = 50
	for i := 0; i < n; i++ {
		if err := browser.WriteFrame(ws.MsgText, []byte(fmt.Sprintf("seq-%03d", i))); err != nil {
			t.Fatalf("write %d: %v", i, err)
		}
	}
	for i := 0; i < n; i++ {
		f, err := browser.ReadFrame()
		if err != nil {
			t.Fatalf("read %d: %v", i, err)
		}
		want := fmt.Sprintf("seq-%03d", i)
		if string(f.Payload) != want {
			t.Fatalf("frame %d = %q, want %q (order broken)", i, f.Payload, want)
		}
	}
}

func TestRelay_ArbitraryPayloadsRoundTrip(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()

	payloads := [][]byte{
		[]byte("plain text"),
		{0x00, 0x00, 0x00, 0x01},
		[]byte("{\"json\":\"text\"}"),
		{0xFF, 0xFF, 0xFF},
	}
	for _, p := range payloads {
		if err := browser.WriteFrame(ws.MsgText, p); err != nil {
			t.Fatalf("write: %v", err)
		}
		f, err := browser.ReadFrame()
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		if string(f.Payload) != string(p) {
			t.Errorf("payload %q round-tripped as %q", p, f.Payload)
		}
	}
}

func TestRelay_PingAnsweredByWSStack(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()

	// Our ws.Conn handles ping/pong at the ReadFrame level: pings are auto-answered.
	// Send a ping and verify the connection stays alive by reading a text frame.
	if err := browser.WriteFrameMasked(ws.MsgPing, []byte("ping")); err != nil {
		t.Fatalf("write ping: %v", err)
	}
	// The server will auto-respond with pong (transparent to reader).
	// Verify the relay still works by sending a data frame.
	if err := browser.WriteFrame(ws.MsgText, []byte("after-ping")); err != nil {
		t.Fatalf("write after ping: %v", err)
	}
	f, err := browser.ReadFrame()
	if err != nil {
		t.Fatalf("read after ping: %v", err)
	}
	if string(f.Payload) != "after-ping" {
		t.Errorf("expected after-ping, got %q", f.Payload)
	}
}

func TestRelay_BackpressureNoFrameLoss(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	token := issueWSToken(t, ts)
	browser := connectBrowser(t, wsBase, token, "agent-1", "ttyd")
	defer browser.Close()
	open := waitControl(t, msgs, "relay-open")
	relayConn := dialRelay(t, wsBase, open.RelayToken)
	defer relayConn.Close()

	// Agent sends a burst of frames; the browser consumes them slowly.
	const n = 100
	go func() {
		for i := 0; i < n; i++ {
			payload := make([]byte, 4096)
			copy(payload, fmt.Sprintf("frame-%03d", i))
			if err := relayConn.WriteFrame(ws.MsgBinary, payload); err != nil {
				return
			}
		}
	}()

	for i := 0; i < n; i++ {
		time.Sleep(2 * time.Millisecond) // slow consumer
		f, err := browser.ReadFrame()
		if err != nil {
			t.Fatalf("read %d: %v (frame lost or connection closed)", i, err)
		}
		if f.MessageType != ws.MsgBinary {
			t.Fatalf("frame %d opcode = %d, want binary", i, f.MessageType)
		}
		want := fmt.Sprintf("frame-%03d", i)
		if string(f.Payload[:len(want)]) != want {
			t.Fatalf("frame %d = %q..., want %q (order broken)", i, f.Payload[:len(want)], want)
		}
	}
}

// ---------------------------------------------------------------------------
// Relay lifecycle
// ---------------------------------------------------------------------------

func TestRelay_BrowserDisconnectClosesUpstreamAndSendsRelayClose(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	agentConn, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)

	// Round-trip a frame to confirm the relay is live.
	if err := browser.WriteFrame(ws.MsgText, []byte("hi")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := browser.ReadFrame(); err != nil {
		t.Fatalf("read: %v", err)
	}

	// Browser disconnects.
	browser.Close()

	// The agent receives relay-close with the correct relay_id.
	closeMsg := waitControl(t, msgs, "relay-close")
	if closeMsg.RelayID == "" {
		t.Error("relay-close must carry a relay_id")
	}

	// The control connection stays alive and the agent stays registered.
	if !srv.AgentRegistry().Has("agent-1") {
		t.Error("agent must stay registered after browser disconnect")
	}
	// The control connection still works: a new relay-open can be delivered.
	token := issueWSToken(t, ts)
	browser2 := connectBrowser(t, wsBase, token, "agent-1", "ttyd")
	defer browser2.Close()
	open := waitControl(t, msgs, "relay-open")
	relayConn := dialRelay(t, wsBase, open.RelayToken)
	upstream2, _, err := dialWS(t, upstream, nil)
	if err != nil {
		t.Fatalf("upstream dial: %v", err)
	}
	pipeConns(relayConn, upstream2)
	if err := browser2.WriteFrame(ws.MsgText, []byte("again")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if f, err := browser2.ReadFrame(); err != nil || string(f.Payload) != "again" {
		t.Fatalf("second session round-trip failed: %v %q", err, f.Payload)
	}
	_ = agentConn
}

func TestRelay_NoOrphanedRelaysAfterDisconnect(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	for i := 0; i < 3; i++ {
		browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
		if err := browser.WriteFrame(ws.MsgText, []byte("x")); err != nil {
			t.Fatalf("write: %v", err)
		}
		if _, err := browser.ReadFrame(); err != nil {
			t.Fatalf("read: %v", err)
		}
		browser.Close()
		waitControl(t, msgs, "relay-close")
	}

	// No leaked relays.
	waitRelayCount(t, srv, 0)

	// A fresh connect works immediately.
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()
	if err := browser.WriteFrame(ws.MsgText, []byte("fresh")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if f, err := browser.ReadFrame(); err != nil || string(f.Payload) != "fresh" {
		t.Fatalf("fresh connect round-trip failed: %v %q", err, f.Payload)
	}
}

func TestRelay_RapidConnectDisconnectCycles(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	for i := 0; i < 10; i++ {
		browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
		if err := browser.WriteFrame(ws.MsgText, []byte("cycle")); err != nil {
			t.Fatalf("cycle %d write: %v", i, err)
		}
		if _, err := browser.ReadFrame(); err != nil {
			t.Fatalf("cycle %d read: %v", i, err)
		}
		browser.Close()
		waitControl(t, msgs, "relay-close")
	}

	waitRelayCount(t, srv, 0)
	if !srv.AgentRegistry().Has("agent-1") {
		t.Error("agent must remain ready after rapid cycles")
	}

	// Final connect works.
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser.Close()
	if err := browser.WriteFrame(ws.MsgText, []byte("final")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if f, err := browser.ReadFrame(); err != nil || string(f.Payload) != "final" {
		t.Fatalf("final round-trip failed: %v %q", err, f.Payload)
	}
}

func TestRelay_TimeoutWhenAgentNeverDials(t *testing.T) {
	srv, wsBase := newWSServerWithTimeout(t, 300*time.Millisecond)
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	token := issueWSToken(t, ts)
	browser := connectBrowser(t, wsBase, token, "agent-1", "ttyd")
	defer browser.Close()

	// The agent receives relay-open but never dials the relay.
	open := waitControl(t, msgs, "relay-open")
	_ = open

	// The browser must get a clean close within a bounded time, not hang.
	start := time.Now()
	waitConnDone(t, browser, "browser should be closed after relay-open timeout")
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("browser close took %v, expected bounded timeout", elapsed)
	}

	// No leaked relay.
	waitRelayCount(t, srv, 0)
}

func TestRelay_AgentControlLossMidRelay(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	agentConn, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)

	// Confirm the relay is live.
	if err := browser.WriteFrame(ws.MsgText, []byte("live")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := browser.ReadFrame(); err != nil {
		t.Fatalf("read: %v", err)
	}

	// Agent control connection drops mid-relay.
	agentConn.Close()

	// The browser observes a clean close.
	waitConnDone(t, browser, "browser should close after agent control loss")

	// Registry reflects the agent as gone.
	deadline := time.Now().Add(2 * time.Second)
	for srv.AgentRegistry().Has("agent-1") && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if srv.AgentRegistry().Has("agent-1") {
		t.Error("agent should be unregistered after control loss")
	}
	waitRelayCount(t, srv, 0)

	// Re-dial re-registers and a new browser connect works.
	runToken := issueRunToken(t, ts, "agent-1")
	agentConn2, msgs2 := startTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn2.Close()
	waitAgentReady(t, ts, "agent-1")

	browser2, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs2)
	defer browser2.Close()
	if err := browser2.WriteFrame(ws.MsgText, []byte("back")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if f, err := browser2.ReadFrame(); err != nil || string(f.Payload) != "back" {
		t.Fatalf("post-reconnect round-trip failed: %v %q", err, f.Payload)
	}
}

func TestRelay_ControlReplacementMidRelay(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	agentConn, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)

	// Confirm the relay is live.
	if err := browser.WriteFrame(ws.MsgText, []byte("live")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := browser.ReadFrame(); err != nil {
		t.Fatalf("read: %v", err)
	}

	// A second control connection replaces the first.
	runToken := issueRunToken(t, ts, "agent-1")
	agentConn2, _ := startTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn2.Close()

	// The active relay is torn down: the browser sees a clean close.
	waitConnDone(t, browser, "browser should close after control replacement")

	// Registry is consistent: exactly one entry.
	if srv.AgentRegistry().Count() != 1 {
		t.Errorf("expected exactly 1 registered agent, got %d", srv.AgentRegistry().Count())
	}
	waitRelayCount(t, srv, 0)
	_ = agentConn
}

func TestRelay_BrowserDisconnectBeforeAgentDialInvalidatesToken(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	token := issueWSToken(t, ts)
	browser := connectBrowser(t, wsBase, token, "agent-1", "ttyd")
	open := waitControl(t, msgs, "relay-open")

	// Browser disconnects before the agent dials.
	browser.Close()

	// Wait for the relay to be cleaned up.
	waitRelayCount(t, srv, 0)

	// A late agent dial with the issued token is rejected.
	_, resp, err := dialWS(t, wsBase+"/ws/relay?relayToken="+open.RelayToken, nil)
	if err == nil {
		t.Fatal("late relay dial must be rejected after browser disconnect")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for late relay dial, got %v", resp)
	}
	waitRelayCount(t, srv, 0)
}

func TestRelay_UpstreamConnectFailureSurfacesAsCleanBrowserClose(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, "ws://127.0.0.1:1/upstream")

	token := issueWSToken(t, ts)
	browser := connectBrowser(t, wsBase, token, "agent-1", "ttyd")
	defer browser.Close()
	open := waitControl(t, msgs, "relay-open")

	// The agent dials the relay but its upstream is unreachable; it closes
	// the relay connection, which must surface as a clean browser close.
	relayConn := dialRelay(t, wsBase, open.RelayToken)
	relayConn.Close()

	waitConnDone(t, browser, "browser should close after upstream failure")
}

// ---------------------------------------------------------------------------
// Fan-out and multi-agent
// ---------------------------------------------------------------------------

func TestRelay_FanOutConcurrentBrowsers(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	// Two concurrent browsers to the same agent+service.
	browser1, open1 := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser1.Close()
	browser2, open2 := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer browser2.Close()

	// Distinct relay ids and tokens.
	if open1.RelayID == open2.RelayID {
		t.Error("concurrent relays must have distinct relay_ids")
	}
	if open1.RelayToken == open2.RelayToken {
		t.Error("concurrent relays must have distinct relay tokens")
	}

	// Independent round-trips, no cross-talk.
	if err := browser1.WriteFrame(ws.MsgText, []byte("one")); err != nil {
		t.Fatalf("browser1 write: %v", err)
	}
	if err := browser2.WriteFrame(ws.MsgText, []byte("two")); err != nil {
		t.Fatalf("browser2 write: %v", err)
	}
	f1, err := browser1.ReadFrame()
	if err != nil || string(f1.Payload) != "one" {
		t.Fatalf("browser1 got %q err %v", f1.Payload, err)
	}
	f2, err := browser2.ReadFrame()
	if err != nil || string(f2.Payload) != "two" {
		t.Fatalf("browser2 got %q err %v", f2.Payload, err)
	}

	// Closing one relay does not close the other.
	browser1.Close()
	waitControl(t, msgs, "relay-close")
	if err := browser2.WriteFrame(ws.MsgText, []byte("still")); err != nil {
		t.Fatalf("browser2 write after browser1 close: %v", err)
	}
	if f, err := browser2.ReadFrame(); err != nil || string(f.Payload) != "still" {
		t.Fatalf("browser2 after sibling close: %q err %v", f.Payload, err)
	}

	waitRelayCount(t, srv, 1)
}

func TestRelay_MultiAgentIsolation(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstreamA := echoUpstream(t, "A:")
	upstreamB := echoUpstream(t, "B:")

	_, msgsA := setupRelay(t, wsBase, ts, "agent-A", []Service{{Name: "ttyd"}}, upstreamA)
	_, msgsB := setupRelay(t, wsBase, ts, "agent-B", []Service{{Name: "ttyd"}}, upstreamB)

	browserA, _ := establishRelay(t, wsBase, ts, "agent-A", "ttyd", upstreamA, msgsA)
	defer browserA.Close()
	browserB, _ := establishRelay(t, wsBase, ts, "agent-B", "ttyd", upstreamB, msgsB)
	defer browserB.Close()

	if err := browserA.WriteFrame(ws.MsgText, []byte("x")); err != nil {
		t.Fatalf("A write: %v", err)
	}
	if err := browserB.WriteFrame(ws.MsgText, []byte("x")); err != nil {
		t.Fatalf("B write: %v", err)
	}
	fA, err := browserA.ReadFrame()
	if err != nil || string(fA.Payload) != "A:x" {
		t.Fatalf("A got %q err %v, want A:x (cross-routing!)", fA.Payload, err)
	}
	fB, err := browserB.ReadFrame()
	if err != nil || string(fB.Payload) != "B:x" {
		t.Fatalf("B got %q err %v, want B:x (cross-routing!)", fB.Payload, err)
	}
}

func TestRelay_MultipleServicesPerAgent(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{
		{Name: "ttyd", Upstream: "ws://127.0.0.1:7080"},
		{Name: "openclaw", Upstream: "ws://127.0.0.1:18789"},
	}, upstream)

	// GET /agents lists both services.
	resp := doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	var agents []AgentInfo
	_ = json.NewDecoder(resp.Body).Decode(&agents)
	resp.Body.Close()
	found := false
	for _, a := range agents {
		if a.AgentID == "agent-1" {
			found = true
			if len(a.Services) != 2 {
				t.Errorf("services = %v, want 2 entries", a.Services)
			}
		}
	}
	if !found {
		t.Fatal("agent-1 not listed")
	}

	// Browser connect to each service works.
	b1, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	defer b1.Close()
	b2, _ := establishRelay(t, wsBase, ts, "agent-1", "openclaw", upstream, msgs)
	defer b2.Close()
}

func TestRelay_ReRegisterReplacesServiceSet(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	agentConn, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	// ttyd is connectable.
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs)
	browser.Close()
	waitControl(t, msgs, "relay-close")

	// Re-register with a different service set (same control connection).
	regMsg, _ := json.Marshal(map[string]interface{}{
		"type":     "register",
		"services": []Service{{Name: "openclaw", Upstream: "ws://127.0.0.1:18789"}},
	})
	if err := agentConn.WriteFrame(ws.MsgText, regMsg); err != nil {
		t.Fatalf("re-register write: %v", err)
	}
	waitAgentReady(t, ts, "agent-1")

	// ttyd is no longer connectable.
	token := issueWSToken(t, ts)
	_, resp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("removed service must not be connectable")
	}
	if resp == nil || resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 for removed service, got %v", resp)
	}

	// openclaw is connectable.
	browser2, _ := establishRelay(t, wsBase, ts, "agent-1", "openclaw", upstream, msgs)
	defer browser2.Close()
}

func TestRelay_AgentMidReconnect(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	agentConn, _ := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	// Control connection drops.
	agentConn.Close()
	deadline := time.Now().Add(2 * time.Second)
	for srv.AgentRegistry().Has("agent-1") && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}

	// Browser connect during the gap is rejected cleanly (not a hang).
	token := issueWSToken(t, ts)
	_, resp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("browser connect during agent gap must fail")
	}
	if resp == nil || resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 during agent gap, got %v", resp)
	}

	// Agent re-dials and re-registers.
	runToken := issueRunToken(t, ts, "agent-1")
	agentConn2, msgs2 := startTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn2.Close()
	waitAgentReady(t, ts, "agent-1")

	// Browser connect works after re-registration.
	browser, _ := establishRelay(t, wsBase, ts, "agent-1", "ttyd", upstream, msgs2)
	defer browser.Close()
	if err := browser.WriteFrame(ws.MsgText, []byte("ok")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if f, err := browser.ReadFrame(); err != nil || string(f.Payload) != "ok" {
		t.Fatalf("round-trip after reconnect failed: %v %q", err, f.Payload)
	}
}

func TestRelay_IdleAgentStaysReady(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	_, _ = setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, "ws://127.0.0.1:1")

	// No relays active; the agent must still be ready.
	resp := doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	var agents []AgentInfo
	_ = json.NewDecoder(resp.Body).Decode(&agents)
	resp.Body.Close()
	for _, a := range agents {
		if a.AgentID == "agent-1" {
			if a.Status != "ready" {
				t.Errorf("idle agent status = %q, want ready", a.Status)
			}
			return
		}
	}
	t.Fatal("agent-1 not listed")
}

func TestRelay_ServiceUnregisteredMidSession(t *testing.T) {
	srv, wsBase := newWSServerWithTimeout(t, 300*time.Millisecond)
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	agentConn, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, "ws://127.0.0.1:1")

	// Browser connects to ttyd (registered at handshake time).
	token := issueWSToken(t, ts)
	browser := connectBrowser(t, wsBase, token, "agent-1", "ttyd")
	defer browser.Close()
	open := waitControl(t, msgs, "relay-open")
	_ = open

	// The agent re-registers without ttyd before dialing the relay.
	regMsg, _ := json.Marshal(map[string]interface{}{
		"type":     "register",
		"services": []Service{{Name: "openclaw"}},
	})
	if err := agentConn.WriteFrame(ws.MsgText, regMsg); err != nil {
		t.Fatalf("re-register write: %v", err)
	}

	// The agent never dials; the browser must get a clean bounded close, not
	// a hang, and the registry must stay consistent.
	waitConnDone(t, browser, "browser should close when service was unregistered mid-session")
	waitRelayCount(t, srv, 0)
	if !srv.AgentRegistry().Has("agent-1") {
		t.Error("agent must remain registered")
	}
}

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

func TestRelay_ConcurrentAgentRegistrations(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	const n = 5
	var wg sync.WaitGroup
	errs := make(chan error, n)
	conns := make([]*ws.Conn, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			agentID := fmt.Sprintf("agent-%d", i)
			req, err := http.NewRequest(http.MethodPost, ts+"/auth/runs?agent="+agentID, nil)
			if err != nil {
				errs <- err
				return
			}
			req.Header.Set("Authorization", basicHeader("admin", "test-password"))
			runResp, err := http.DefaultClient.Do(req)
			if err != nil {
				errs <- err
				return
			}
			var body map[string]interface{}
			if err := json.NewDecoder(runResp.Body).Decode(&body); err != nil {
				runResp.Body.Close()
				errs <- err
				return
			}
			runResp.Body.Close()
			runToken, _ := body["run_token"].(string)
			if runToken == "" {
				errs <- fmt.Errorf("agent-%d: no run token", i)
				return
			}
			conn, resp, err := dialWS(t, wsBase+"/ws/agent?agent="+agentID, map[string]string{
				"Authorization": "Bearer " + runToken,
			})
			if err != nil {
				errs <- fmt.Errorf("agent-%d dial: %v (resp %v)", i, err, resp)
				return
			}
			conns[i] = conn
			msg, _ := json.Marshal(map[string]interface{}{
				"type":     "register",
				"services": []Service{{Name: "ttyd"}},
			})
			if err := conn.WriteFrame(ws.MsgText, msg); err != nil {
				errs <- fmt.Errorf("agent-%d register write: %v", i, err)
				return
			}
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	for _, c := range conns {
		if c != nil {
			defer c.Close()
		}
	}

	// Registration is processed asynchronously; poll until all agents appear.
	deadline := time.Now().Add(3 * time.Second)
	var agents []AgentInfo
	for {
		resp := doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
			"Authorization": basicHeader("admin", "test-password"),
		})
		agents = nil
		_ = json.NewDecoder(resp.Body).Decode(&agents)
		resp.Body.Close()
		if len(agents) == n {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("expected %d agents, got %d", n, len(agents))
		}
		time.Sleep(10 * time.Millisecond)
	}
	seen := make(map[string]bool)
	for _, a := range agents {
		seen[a.AgentID] = true
		if a.Status != "ready" {
			t.Errorf("agent %s status = %q, want ready", a.AgentID, a.Status)
		}
	}
	for i := 0; i < n; i++ {
		if !seen[fmt.Sprintf("agent-%d", i)] {
			t.Errorf("agent-%d missing from registry", i)
		}
	}
}

func TestRelay_ConcurrentBrowsersIndependent(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	upstream := echoUpstream(t, "")

	_, msgs := setupRelay(t, wsBase, ts, "agent-1", []Service{{Name: "ttyd"}}, upstream)

	const n = 5
	var wg sync.WaitGroup
	errs := make(chan error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			token := issueWSToken(t, ts)
			browser := connectBrowser(t, wsBase, token, "agent-1", "ttyd")
			defer browser.Close()
			open := waitControl(t, msgs, "relay-open")
			relayConn := dialRelay(t, wsBase, open.RelayToken)
			up, _, err := dialWS(t, upstream, nil)
			if err != nil {
				errs <- err
				return
			}
			pipeConns(relayConn, up)
			msg := fmt.Sprintf("client-%d", i)
			if err := browser.WriteFrame(ws.MsgText, []byte(msg)); err != nil {
				errs <- err
				return
			}
			f, err := browser.ReadFrame()
			if err != nil {
				errs <- err
				return
			}
			if string(f.Payload) != msg {
				errs <- fmt.Errorf("client %d got %q, want %q", i, f.Payload, msg)
			}
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}

	// Teardown is asynchronous; poll until no relays remain.
	waitRelayCount(t, srv, 0)
}

// suppress io import if only used as _ in certain tests
var _ = io.EOF
