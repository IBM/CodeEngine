package tunnel

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/job-agent/internal/ws"
)

// testControlServer is a fake apiserver control endpoint for tests. It
// records the Authorization header, the agent query param, and control
// messages, and can send relay-open/relay-close messages. It also serves
// /ws/relay so the agent's relay dial lands on the same host as the control
// connection (mirroring the real apiserver).
type testControlServer struct {
	server      *httptest.Server
	mu          sync.Mutex
	authHeader  string
	agentParam  string
	registers   []registerMessage
	conns       []*ws.Conn
	connMu      sync.Mutex
	onConnect   func(conn *ws.Conn)
	reject      bool
	rejectCount int
	relay       *testRelayServer
}

func newTestControlServer() *testControlServer {
	ts := &testControlServer{}
	mux := http.NewServeMux()
	mux.HandleFunc("/ws/agent", func(w http.ResponseWriter, r *http.Request) {
		ts.mu.Lock()
		ts.authHeader = r.Header.Get("Authorization")
		ts.agentParam = r.URL.Query().Get("agent")
		reject := ts.reject
		ts.mu.Unlock()
		if reject {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		conn, err := ws.Upgrade(w, r)
		if err != nil {
			return
		}
		ts.connMu.Lock()
		ts.conns = append(ts.conns, conn)
		ts.connMu.Unlock()
		if ts.onConnect != nil {
			ts.onConnect(conn)
		}
		// Read control messages until the connection closes.
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var reg registerMessage
			if err := json.Unmarshal(msg, &reg); err == nil && reg.Type == controlRegister {
				ts.mu.Lock()
				ts.registers = append(ts.registers, reg)
				ts.mu.Unlock()
			}
		}
	})
	// The relay endpoint shares the control server's host so the agent's
	// relay dial (derived from GATEWAY_WSS) reaches it.
	ts.relay = &testRelayServer{}
	mux.HandleFunc("/ws/relay", ts.relay.handle)
	ts.server = httptest.NewServer(mux)
	return ts
}

func (ts *testControlServer) close() {
	ts.connMu.Lock()
	for _, c := range ts.conns {
		_ = c.Close()
	}
	ts.connMu.Unlock()
	ts.relay.close()
	ts.server.Close()
}

func (ts *testControlServer) sendRelayOpen(conn *ws.Conn, relayID, service, token string) error {
	return conn.WriteJSON(map[string]interface{}{
		"type":        "relay-open",
		"relay_id":    relayID,
		"service":     service,
		"relay_token": token,
	})
}

func (ts *testControlServer) sendRelayClose(conn *ws.Conn, relayID string) error {
	return conn.WriteJSON(map[string]interface{}{
		"type":     "relay-close",
		"relay_id": relayID,
	})
}

func (ts *testControlServer) currentConn() *ws.Conn {
	ts.connMu.Lock()
	defer ts.connMu.Unlock()
	if len(ts.conns) == 0 {
		return nil
	}
	return ts.conns[len(ts.conns)-1]
}

func (ts *testControlServer) registerCount() int {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	return len(ts.registers)
}

func (ts *testControlServer) lastRegister() *registerMessage {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	if len(ts.registers) == 0 {
		return nil
	}
	return &ts.registers[len(ts.registers)-1]
}

func testConfigForServer(t *testing.T, wsURL string) *Config {
	t.Helper()
	// httptest servers are http://; convert to ws:// for the gateway.
	wsBase := "ws" + strings.TrimPrefix(wsURL, "http")
	gateway := strings.TrimSuffix(wsBase, "/") + "/ws"
	return &Config{
		AgentID:          "agent-1",
		RunToken:         "run-token-1",
		GatewayWSS:       gateway,
		TTYDPort:         "7080",
		HealthPort:       "7081",
		Workspace:        "/workspace",
		BobMode:          "interactive",
		BobShellAPIKey:   "bob-key",
		IdleTimeout:      5 * time.Minute,
		ReconnectDelay:   50 * time.Millisecond,
		TTYDReadyTimeout: 2 * time.Second,
		TmuxDeathGrace:   5 * time.Second,
	}
}

// TestControlDialWithRunToken verifies the control dial carries the run token
// in the Authorization header (never in the URL) and registers the ttyd
// service.
func TestControlDialWithRunToken(t *testing.T) {
	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cl := newControlLoop(cfg, newTTYDAdapter("ws://127.0.0.1:7080"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()

	// Wait for registration.
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if ts.registerCount() > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if ts.registerCount() == 0 {
		t.Fatal("agent never registered")
	}

	ts.mu.Lock()
	auth := ts.authHeader
	agent := ts.agentParam
	ts.mu.Unlock()
	if auth != "Bearer run-token-1" {
		t.Errorf("Authorization header = %q, want Bearer run-token-1", auth)
	}
	if agent != "agent-1" {
		t.Errorf("agent query param = %q, want agent-1", agent)
	}
	reg := ts.lastRegister()
	if reg == nil || len(reg.Services) != 1 {
		t.Fatalf("register services = %+v, want exactly one service", reg)
	}
	if reg.Services[0].Name != "ttyd" || reg.Services[0].Upstream != "ws://127.0.0.1:7080" {
		t.Errorf("registered service = %+v, want ttyd at ws://127.0.0.1:7080", reg.Services[0])
	}
}

// TestControlReconnectWithBackoff verifies that control loss triggers a
// re-dial with backoff and re-registration without restarting tmux/ttyd.
func TestControlReconnectWithBackoff(t *testing.T) {
	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cfg.ReconnectDelay = 30 * time.Millisecond
	cl := newControlLoop(cfg, newTTYDAdapter("ws://127.0.0.1:7080"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()

	// Wait for the first registration.
	waitForRegistrations(t, ts, 1)

	// Drop the first control connection; the loop should re-dial and
	// re-register.
	first := ts.currentConn()
	if first != nil {
		_ = first.Close()
	}
	waitForRegistrations(t, ts, 2)

	// The re-registration must carry the same service set.
	reg := ts.lastRegister()
	if reg == nil || len(reg.Services) != 1 || reg.Services[0].Name != "ttyd" {
		t.Errorf("re-register = %+v, want ttyd service", reg)
	}
}

// TestControlRejectedRedialRetries verifies a rejected re-dial (invalid run
// token) is retried with backoff, not a crash or spin.
func TestControlRejectedRedialRetries(t *testing.T) {
	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cfg.ReconnectDelay = 20 * time.Millisecond
	cl := newControlLoop(cfg, newTTYDAdapter("ws://127.0.0.1:7080"))

	// Reject the first dial, then accept.
	ts.mu.Lock()
	ts.reject = true
	ts.mu.Unlock()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()

	// Let the rejected dial happen, then allow connections.
	time.Sleep(100 * time.Millisecond)
	ts.mu.Lock()
	ts.reject = false
	ts.mu.Unlock()

	// The agent should eventually connect and register.
	waitForRegistrations(t, ts, 1)
}

// TestRelayOpenHandshakeAndPipe verifies the full relay flow: relay-open →
// upstream dial with ttyd handshake → first browser frame forwarded → opaque
// pipe.
func TestRelayOpenHandshakeAndPipe(t *testing.T) {
	// Fake ttyd upstream that records the handshake and echoes frames.
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()

	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cl := newControlLoop(cfg, newTTYDAdapter(upstream.wsURL))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()
	waitForRegistrations(t, ts, 1)

	// Fake relay endpoint that accepts the agent's relay dial and pipes.
	relay := ts.relay

	// Send relay-open; the agent dials the relay and the upstream.
	conn := ts.currentConn()
	if conn == nil {
		t.Fatal("no control connection")
	}
	if err := ts.sendRelayOpen(conn, "relay-1", "ttyd", "relay-token-1"); err != nil {
		t.Fatal(err)
	}

	// Wait for the upstream to receive the handshake.
	upstream.waitForHandshake(t)
	relay.waitForConn(t, 1)

	// The relay server sends the first browser frame (a resize frame).
	relay.sendFirstFrame([]byte{'1', '{', '"', 'c', 'o', 'l', 'u', 'm', 'n', 's', '"', ':', '1', '2', '0', ',', '"', 'r', 'o', 'w', 's', '"', ':', '3', '0', '}'})

	// The upstream must receive the first frame (resize forwarded).
	upstream.waitForFrame(t, []byte{'1', '{', '"', 'c', 'o', 'l', 'u', 'm', 'n', 's', '"', ':', '1', '2', '0', ',', '"', 'r', 'o', 'w', 's', '"', ':', '3', '0', '}'})

	// Opaque pipe: relay → upstream and upstream → relay.
	relay.sendFrame([]byte("hello from browser"))
	upstream.waitForFrame(t, []byte("hello from browser"))

	upstream.sendFrame([]byte("output from ttyd"))
	relay.waitForFrame(t, []byte("output from ttyd"))
}

// TestRelayCloseClosesUpstream verifies relay-close closes the upstream.
func TestRelayCloseClosesUpstream(t *testing.T) {
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()

	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cl := newControlLoop(cfg, newTTYDAdapter(upstream.wsURL))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()
	waitForRegistrations(t, ts, 1)

	conn := ts.currentConn()
	if err := ts.sendRelayOpen(conn, "relay-2", "ttyd", "relay-token-2"); err != nil {
		t.Fatal(err)
	}
	upstream.waitForHandshake(t)

	// relay-close should close the upstream connection.
	if err := ts.sendRelayClose(conn, "relay-2"); err != nil {
		t.Fatal(err)
	}
	upstream.waitForClose(t)
}

// TestRelayOpenUnreachableUpstreamFailsCleanly verifies a relay-open for an
// unreachable upstream fails cleanly and the agent stays registered.
func TestRelayOpenUnreachableUpstreamFailsCleanly(t *testing.T) {
	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	// Upstream points at a closed port.
	cl := newControlLoop(cfg, newTTYDAdapter("ws://127.0.0.1:1"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()
	waitForRegistrations(t, ts, 1)

	conn := ts.currentConn()
	if err := ts.sendRelayOpen(conn, "relay-3", "ttyd", "relay-token-3"); err != nil {
		t.Fatal(err)
	}

	// The agent must stay registered (control connection alive).
	time.Sleep(200 * time.Millisecond)
	if ts.registerCount() != 1 {
		t.Errorf("agent unregistered after failed relay-open: %d registrations", ts.registerCount())
	}
	// Control connection still usable: a second relay-open is accepted.
	if err := ts.sendRelayOpen(conn, "relay-4", "ttyd", "relay-token-4"); err != nil {
		t.Errorf("control connection unusable after failed relay-open: %v", err)
	}
}

// TestRelayOpenUnknownServiceIgnored verifies relay-open for an unregistered
// service is ignored cleanly.
func TestRelayOpenUnknownServiceIgnored(t *testing.T) {
	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cl := newControlLoop(cfg, newTTYDAdapter("ws://127.0.0.1:7080"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()
	waitForRegistrations(t, ts, 1)

	conn := ts.currentConn()
	if err := ts.sendRelayOpen(conn, "relay-5", "doesnotexist", "relay-token-5"); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)
	if ts.registerCount() != 1 {
		t.Errorf("agent unregistered after unknown-service relay-open")
	}
}

func waitForRegistrations(t *testing.T, ts *testControlServer, n int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if ts.registerCount() >= n {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected %d registrations, got %d", n, ts.registerCount())
}

// testTTYDUpstream is a fake ttyd server that records the handshake and
// echoes frames.
type testTTYDUpstream struct {
	server  *httptest.Server
	wsURL   string
	mu      sync.Mutex
	writeMu sync.Mutex
	handshake []byte
	frames  [][]byte
	closed  chan struct{}
	conn    *ws.Conn
}

func newTestTTYDUpstream(t *testing.T) *testTTYDUpstream {
	t.Helper()
	u := &testTTYDUpstream{closed: make(chan struct{})}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		conn, err := ws.Upgrade(w, r)
		if err != nil {
			return
		}
		u.mu.Lock()
		u.conn = conn
		u.mu.Unlock()
		defer func() {
			select {
			case <-u.closed:
			default:
				close(u.closed)
			}
		}()
		for {
			_, payload, err := conn.ReadMessage()
			if err != nil {
				return
			}
			u.mu.Lock()
			if len(u.handshake) == 0 {
				u.handshake = append([]byte(nil), payload...)
			} else {
				u.frames = append(u.frames, append([]byte(nil), payload...))
			}
			u.mu.Unlock()
			// Echo the frame back so the relay round-trips.
			u.writeMu.Lock()
			_ = conn.WriteFrame(ws.MsgBinary, payload)
			u.writeMu.Unlock()
		}
	})
	u.server = httptest.NewServer(mux)
	u.wsURL = "ws" + strings.TrimPrefix(u.server.URL, "http")
	return u
}

func (u *testTTYDUpstream) close() {
	u.mu.Lock()
	if u.conn != nil {
		_ = u.conn.Close()
	}
	u.mu.Unlock()
	u.server.Close()
}

func (u *testTTYDUpstream) waitForHandshake(t *testing.T) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		u.mu.Lock()
		hs := len(u.handshake) > 0
		u.mu.Unlock()
		if hs {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("upstream never received the ttyd handshake")
}

func (u *testTTYDUpstream) waitForFrame(t *testing.T, want []byte) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		u.mu.Lock()
		var found bool
		for _, f := range u.frames {
			if string(f) == string(want) {
				found = true
				break
			}
		}
		u.mu.Unlock()
		if found {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("upstream never received frame %q (got %q)", want, u.allFrames())
}

func (u *testTTYDUpstream) allFrames() [][]byte {
	u.mu.Lock()
	defer u.mu.Unlock()
	out := make([][]byte, len(u.frames))
	copy(out, u.frames)
	return out
}

func (u *testTTYDUpstream) sendFrame(payload []byte) {
	u.mu.Lock()
	conn := u.conn
	u.mu.Unlock()
	if conn != nil {
		u.writeMu.Lock()
		_ = conn.WriteFrame(ws.MsgBinary, payload)
		u.writeMu.Unlock()
	}
}

func (u *testTTYDUpstream) waitForClose(t *testing.T) {
	t.Helper()
	select {
	case <-u.closed:
	case <-time.After(5 * time.Second):
		t.Fatal("upstream connection was not closed after relay-close")
	}
}

// testRelayServer is a fake /ws/relay endpoint that accepts the agent's relay
// dials and lets the test send/receive frames. It is mounted on the control
// server's mux so the agent's relay dial (derived from GATEWAY_WSS) reaches
// it. It tracks multiple concurrent relay connections (fan-out).
type testRelayServer struct {
	mu     sync.Mutex
	conns  []*ws.Conn
	frames [][]byte
}

func (r *testRelayServer) handle(w http.ResponseWriter, req *http.Request) {
	conn, err := ws.Upgrade(w, req)
	if err != nil {
		return
	}
	r.mu.Lock()
	r.conns = append(r.conns, conn)
	r.mu.Unlock()
	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			return
		}
		r.mu.Lock()
		r.frames = append(r.frames, append([]byte(nil), payload...))
		r.mu.Unlock()
	}
}

func (r *testRelayServer) close() {
	r.mu.Lock()
	for _, c := range r.conns {
		_ = c.Close()
	}
	r.mu.Unlock()
}

// waitForConn blocks until at least n agent relay connections are live.
func (r *testRelayServer) waitForConn(t *testing.T, n int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		r.mu.Lock()
		count := len(r.conns)
		r.mu.Unlock()
		if count >= n {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected %d relay dials, got %d", n, len(r.conns))
}

// sendFirstFrame writes a frame on the first live relay connection.
func (r *testRelayServer) sendFirstFrame(payload []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.conns) > 0 {
		_ = r.conns[0].WriteFrame(ws.MsgBinary, payload)
	}
}

// sendFrameOn writes a frame on the i-th live relay connection.
func (r *testRelayServer) sendFrameOn(i int, payload []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if i < len(r.conns) {
		_ = r.conns[i].WriteFrame(ws.MsgBinary, payload)
	}
}

func (r *testRelayServer) sendFrame(payload []byte) {
	r.sendFirstFrame(payload)
}

func (r *testRelayServer) waitForFrame(t *testing.T, want []byte) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		r.mu.Lock()
		var found bool
		for _, f := range r.frames {
			if string(f) == string(want) {
				found = true
				break
			}
		}
		r.mu.Unlock()
		if found {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("relay never received frame %q", want)
}

var _ = sync.Mutex{}
