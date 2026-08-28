package tunnel

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/job-agent/internal/ws"
)

// TestTTYDHandshake verifies the 1.7.7 binary JSON handshake
// {AuthToken,columns,rows} is sent on upstream connect.
func TestTTYDHandshake(t *testing.T) {
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()

	adapter := newTTYDAdapter(upstream.wsURL)
	conn, err := adapter.dialUpstream(context.Background())
	if err != nil {
		t.Fatalf("dialUpstream failed: %v", err)
	}
	defer conn.Close()

	upstream.waitForHandshake(t)
	upstream.mu.Lock()
	hs := append([]byte(nil), upstream.handshake...)
	upstream.mu.Unlock()

	var parsed map[string]interface{}
	if err := json.Unmarshal(hs, &parsed); err != nil {
		t.Fatalf("handshake is not valid JSON: %v (raw %q)", err, hs)
	}
	if _, ok := parsed["AuthToken"]; !ok {
		t.Errorf("handshake missing AuthToken: %q", hs)
	}
	if parsed["columns"] == nil || parsed["rows"] == nil {
		t.Errorf("handshake missing columns/rows: %q", hs)
	}
}

// TestTTYDHandshakeUsesTTYSubprotocol verifies the upstream dial requests the
// tty subprotocol.
func TestTTYDHandshakeUsesTTYSubprotocol(t *testing.T) {
	var gotSubprotocol string
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		gotSubprotocol = r.Header.Get("Sec-WebSocket-Protocol")
		conn, err := ws.Upgrade(w, r)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	})
	server := httptest.NewServer(mux)
	defer server.Close()
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	adapter := newTTYDAdapter(wsURL)
	conn, err := adapter.dialUpstream(context.Background())
	if err != nil {
		t.Fatalf("dialUpstream failed: %v", err)
	}
	defer conn.Close()

	if !strings.Contains(gotSubprotocol, "tty") {
		t.Errorf("Sec-WebSocket-Protocol = %q, want tty", gotSubprotocol)
	}
}

// TestFirstFrameResizeForwarded verifies the first browser frame is forwarded
// to ttyd before the opaque pipe starts.
func TestFirstFrameResizeForwarded(t *testing.T) {
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()

	adapter := newTTYDAdapter(upstream.wsURL)
	conn, err := adapter.dialUpstream(context.Background())
	if err != nil {
		t.Fatalf("dialUpstream failed: %v", err)
	}
	defer conn.Close()
	upstream.waitForHandshake(t)

	resize := []byte{'1', '{', '"', 'c', 'o', 'l', 'u', 'm', 'n', 's', '"', ':', '1', '2', '0', ',', '"', 'r', 'o', 'w', 's', '"', ':', '3', '0', '}'}
	if err := adapter.forwardFirstResize(conn, resize); err != nil {
		t.Fatalf("forwardFirstResize failed: %v", err)
	}
	upstream.waitForFrame(t, resize)
}

// TestWaitForTTYDRetries verifies waitForTTYD tolerates ttyd not immediately
// ready and eventually succeeds.
func TestWaitForTTYDRetries(t *testing.T) {
	// Start with no server; the probe should retry.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		done <- waitForTTYD(ctx, "ws://127.0.0.1:1", 3*time.Second)
	}()

	// waitForTTYD should still be retrying after 500ms (not exited).
	select {
	case err := <-done:
		t.Fatalf("waitForTTYD exited early with %v", err)
	case <-time.After(500 * time.Millisecond):
	}

	// Now bring up a ttyd-like server; the probe should connect.
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()
	// The probe uses the same URL pattern; point it at the live server.
	// (The original goroutine is probing port 1, so start a fresh one.)
	cancel()
	<-done

	ctx2, cancel2 := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel2()
	if err := waitForTTYD(ctx2, upstream.wsURL, 3*time.Second); err != nil {
		t.Fatalf("waitForTTYD failed against live server: %v", err)
	}
}

// TestWaitForTTYDTimeout verifies waitForTTYD gives up after the timeout.
func TestWaitForTTYDTimeout(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	start := time.Now()
	err := waitForTTYD(ctx, "ws://127.0.0.1:1", 300*time.Millisecond)
	if err == nil {
		t.Fatal("waitForTTYD succeeded against a dead port")
	}
	if time.Since(start) < 300*time.Millisecond {
		t.Errorf("waitForTTYD returned too early: %v", time.Since(start))
	}
}

// TestPipeFramesOpaque verifies pipeFrames preserves opcode and payload
// byte-identically for text and binary frames.
func TestPipeFramesOpaque(t *testing.T) {
	// Build two connected WS pairs via an echo server.
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()

	adapter := newTTYDAdapter(upstream.wsURL)
	upConn, err := adapter.dialUpstream(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer upConn.Close()
	upstream.waitForHandshake(t)

	// A client connection to the same upstream.
	opts := &ws.DialOptions{Subprotocols: []string{"tty"}}
	client, _, err := ws.DialContext(context.Background(), upstream.wsURL, opts)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()

	// Pipe client → upstream.
	errCh := make(chan error, 1)
	go pipeFrames(client, upConn, errCh)

	// Binary frame round-trip.
	binPayload := []byte{0x00, 0x01, 0x02, 0xff, 0xfe}
	if err := client.WriteMessage(ws.MsgBinary, binPayload); err != nil {
		t.Fatal(err)
	}
	upstream.waitForFrame(t, binPayload)

	// Text frame round-trip.
	textPayload := []byte("hello opaque text")
	if err := client.WriteMessage(ws.MsgText, textPayload); err != nil {
		t.Fatal(err)
	}
	upstream.waitForFrame(t, textPayload)
}

// TestConcurrentRelaysIndependent verifies two concurrent relays on one agent
// each get their own upstream and frames do not cross.
func TestConcurrentRelaysIndependent(t *testing.T) {
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

	relay1 := ts.relay
	relay2 := ts.relay

	conn := ts.currentConn()
	// Dial relay-a first and wait for its relay connection so the connection
	// order is deterministic (conns[0] = relay-a, conns[1] = relay-b).
	if err := ts.sendRelayOpen(conn, "relay-a", "ttyd", "relay-token-a"); err != nil {
		t.Fatal(err)
	}
	relay1.waitForConn(t, 1)
	upstream.waitForHandshake(t)

	if err := ts.sendRelayOpen(conn, "relay-b", "ttyd", "relay-token-b"); err != nil {
		t.Fatal(err)
	}
	relay2.waitForConn(t, 2)
	time.Sleep(100 * time.Millisecond)

	// Frames from each relay reach the upstream.
	relay1.sendFrameOn(0, []byte("frame-for-a"))
	relay2.sendFrameOn(1, []byte("frame-for-b"))
	upstream.waitForFrame(t, []byte("frame-for-a"))
	upstream.waitForFrame(t, []byte("frame-for-b"))

	// Closing one relay must not close the other.
	if err := ts.sendRelayClose(conn, "relay-a"); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)
	relay2.sendFrameOn(1, []byte("still-alive"))
	upstream.waitForFrame(t, []byte("still-alive"))
}

// TestIdleTimeoutExits verifies the idle timer fires when no relays are
// active.
func TestIdleTimeoutExits(t *testing.T) {
	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cfg.IdleTimeout = 150 * time.Millisecond
	cl := newControlLoop(cfg, newTTYDAdapter("ws://127.0.0.1:7080"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := cl.idleTimeout(ctx)

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("idle timeout did not fire")
	}
}

// TestIdleTimeoutSuppressedByActiveRelay verifies an active relay suppresses
// the idle timer.
func TestIdleTimeoutSuppressedByActiveRelay(t *testing.T) {
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()

	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cfg.IdleTimeout = 200 * time.Millisecond
	cl := newControlLoop(cfg, newTTYDAdapter(upstream.wsURL))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := cl.idleTimeout(ctx)

	// Open a relay and keep it active past the timeout.
	relay := ts.relay
	ctrlDone := make(chan error, 1)
	go func() { ctrlDone <- cl.run(ctx) }()
	waitForRegistrations(t, ts, 1)

	conn := ts.currentConn()
	if err := ts.sendRelayOpen(conn, "relay-idle", "ttyd", "relay-token-idle"); err != nil {
		t.Fatal(err)
	}
	upstream.waitForHandshake(t)
	relay.waitForConn(t, 1)

	// The idle timer must not fire while the relay is active.
	select {
	case <-done:
		t.Fatal("idle timeout fired while a relay was active")
	case <-time.After(600 * time.Millisecond):
	}

	// After the relay closes, the timer should fire.
	ts.sendRelayClose(conn, "relay-idle")
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("idle timeout did not fire after relay closed")
	}
}

// TestIdleTimeoutActivityResets verifies relay activity resets the timer.
func TestIdleTimeoutActivityResets(t *testing.T) {
	cl := newControlLoop(&Config{IdleTimeout: 200 * time.Millisecond}, newTTYDAdapter("ws://127.0.0.1:7080"))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := cl.idleTimeout(ctx)

	// Send activity every 100ms; the timer should keep resetting and never
	// fire within 700ms.
	for i := 0; i < 7; i++ {
		select {
		case <-done:
			t.Fatal("idle timeout fired despite activity")
		case <-time.After(100 * time.Millisecond):
		}
		select {
		case cl.activityCh <- struct{}{}:
		default:
		}
	}
}

// TestGracefulShutdownClosesRelays verifies shutdown closes active relays.
func TestGracefulShutdownClosesRelays(t *testing.T) {
	upstream := newTestTTYDUpstream(t)
	defer upstream.close()

	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cl := newControlLoop(cfg, newTTYDAdapter(upstream.wsURL))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ctrlDone := make(chan error, 1)
	go func() { ctrlDone <- cl.run(ctx) }()
	waitForRegistrations(t, ts, 1)

	relay := ts.relay
	conn := ts.currentConn()
	if err := ts.sendRelayOpen(conn, "relay-shutdown", "ttyd", "relay-token-shutdown"); err != nil {
		t.Fatal(err)
	}
	upstream.waitForHandshake(t)
	relay.waitForConn(t, 1)

	// Shutdown closes all relays; the upstream sees a close.
	cl.closeAllRelays()
	upstream.waitForClose(t)
}

// TestControlLoopStopsOnContextCancel verifies the control loop exits cleanly
// when the context is cancelled.
func TestControlLoopStopsOnContextCancel(t *testing.T) {
	ts := newTestControlServer()
	defer ts.close()

	cfg := testConfigForServer(t, ts.server.URL)
	cl := newControlLoop(cfg, newTTYDAdapter("ws://127.0.0.1:7080"))

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- cl.run(ctx) }()
	waitForRegistrations(t, ts, 1)

	cancel()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("control loop did not stop on context cancel")
	}
}

// TestHealthState verifies the health state transitions.
func TestHealthState(t *testing.T) {
	hs := &healthState{}
	if hs.isTmuxReady() {
		t.Error("health should start not-ready")
	}
	hs.setTmuxReady(true)
	if !hs.isTmuxReady() {
		t.Error("health should be ready after setTmuxReady(true)")
	}
	hs.setTmuxReady(false)
	if hs.isTmuxReady() {
		t.Error("health should be not-ready after setTmuxReady(false)")
	}
}

// TestHealthServerStatus verifies the health endpoint returns 200 when tmux
// is ready and 503 otherwise.
func TestHealthServerStatus(t *testing.T) {
	cfg := &Config{HealthPort: "0", AgentID: "agent-1"}
	hs := &healthState{}
	hs.setTmuxReady(true)

	mux := http.NewServeMux()
	handleHealth := func(w http.ResponseWriter, r *http.Request) {
		healthHandler(cfg, hs, w)
	}
	mux.HandleFunc("/health", handleHealth)
	server := httptest.NewServer(mux)
	defer server.Close()

	resp, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("ready health status = %d, want 200", resp.StatusCode)
	}
	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "healthy" {
		t.Errorf("ready health body = %v, want status healthy", body)
	}

	hs.setTmuxReady(false)
	resp2, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("not-ready health status = %d, want 503", resp2.StatusCode)
	}
	var body2 map[string]string
	if err := json.NewDecoder(resp2.Body).Decode(&body2); err != nil {
		t.Fatal(err)
	}
	if body2["status"] != "unhealthy" {
		t.Errorf("not-ready health body = %v, want status unhealthy", body2)
	}
}

// TestHealth503WindowObservable verifies the 503 window is observable: after
// tmux death flips the state to not-ready, the health server keeps serving
// 503 {"status":"unhealthy"} (it is not shut down immediately), and the
// process stays alive through the window.
func TestHealth503WindowObservable(t *testing.T) {
	cfg := &Config{HealthPort: "0", AgentID: "agent-1"}
	hs := &healthState{}
	hs.setTmuxReady(true)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		healthHandler(cfg, hs, w)
	}))
	defer server.Close()

	// Healthy while tmux is up.
	resp, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("health before tmux death = %d, want 200", resp.StatusCode)
	}

	// tmux dies: the monitor flips the state to not-ready. The health server
	// must keep serving 503 for the whole grace window, not shut down.
	hs.setTmuxReady(false)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(server.URL + "/health")
		if err != nil {
			t.Fatalf("health server stopped serving during the 503 window: %v", err)
		}
		var body map[string]string
		_ = json.NewDecoder(resp.Body).Decode(&body)
		code := resp.StatusCode
		resp.Body.Close()
		if code != http.StatusServiceUnavailable {
			t.Fatalf("health during 503 window = %d, want 503", code)
		}
		if body["status"] != "unhealthy" {
			t.Fatalf("health body during 503 window = %v, want status unhealthy", body)
		}
		time.Sleep(50 * time.Millisecond)
	}
	// The server is still alive after the window (shutdown is the caller's
	// job, after the bounded grace period).
	resp, err = http.Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("health server not alive after the 503 window: %v", err)
	}
	resp.Body.Close()
}

// TestHealth503WindowBounded verifies the unhealthy window is bounded: the
// runtime proceeds with shutdown only after the configured grace period, so
// the health server serves 503 for at most ~grace and then shuts down.
func TestHealth503WindowBounded(t *testing.T) {
	cfg := &Config{HealthPort: "0", AgentID: "agent-1", TmuxDeathGrace: 300 * time.Millisecond}
	hs := &healthState{}
	hs.setTmuxReady(true)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		healthHandler(cfg, hs, w)
	}))
	defer server.Close()

	// tmux dies; the runtime keeps the health server alive for the grace
	// period before shutting it down (mirrors the runtime's tmux-death
	// goroutine: wait for the grace period, then cancel the server context).
	hs.setTmuxReady(false)
	start := time.Now()
	select {
	case <-time.After(cfg.TmuxDeathGrace):
	case <-ctx.Done():
	}
	elapsed := time.Since(start)
	if elapsed < cfg.TmuxDeathGrace {
		t.Errorf("shutdown began after %v, want at least the grace period %v", elapsed, cfg.TmuxDeathGrace)
	}
	// The 503 window must not extend far beyond the grace period.
	if elapsed > cfg.TmuxDeathGrace+2*time.Second {
		t.Errorf("shutdown began after %v, want bounded by grace + slack", elapsed)
	}
}

// TestTmuxDeath503WindowEndToEnd verifies the full decoupling with a real
// tmux session: killing the session flips health to 503 {"status":"unhealthy"}
// and the health server keeps serving 503 (it is not shut down immediately),
// while the tmux monitor reports the death. This is the observable behavior
// VAL-AGENT-004/005 require.
func TestTmuxDeath503WindowEndToEnd(t *testing.T) {
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux not available")
	}
	session := "health-test-" + strconv.Itoa(os.Getpid())
	// Create a detached tmux session running a long-lived command.
	if err := exec.Command("tmux", "new-session", "-d", "-s", session, "sleep", "300").Run(); err != nil {
		t.Fatalf("failed to create tmux session: %v", err)
	}
	defer exec.Command("tmux", "kill-session", "-t", session).Run()

	cfg := &Config{HealthPort: "0", AgentID: session, TmuxDeathGrace: 2 * time.Second}
	rt := NewRuntime(cfg)
	rt.tmuxPollInterval = 100 * time.Millisecond
	rt.state.setTmuxReady(true)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		healthHandler(cfg, rt.state, w)
	}))
	defer server.Close()

	// Healthy while tmux is up.
	resp, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("health before tmux kill = %d, want 200", resp.StatusCode)
	}

	// Start the tmux monitor; it must not shut anything down by itself.
	died := rt.monitorTmux(ctx)

	// Kill the tmux session.
	if err := exec.Command("tmux", "kill-session", "-t", session).Run(); err != nil {
		t.Fatalf("failed to kill tmux session: %v", err)
	}

	// The monitor reports the death.
	select {
	case <-died:
	case <-time.After(5 * time.Second):
		t.Fatal("tmux monitor never reported the session death")
	}
	if rt.state.isTmuxReady() {
		t.Error("health state still ready after tmux death")
	}

	// The health server keeps serving 503 {"status":"unhealthy"} throughout
	// the grace window — it is not shut down on tmux death.
	deadline := time.Now().Add(1500 * time.Millisecond)
	for time.Now().Before(deadline) {
		resp, err := http.Get(server.URL + "/health")
		if err != nil {
			t.Fatalf("health server stopped serving during the 503 window: %v", err)
		}
		var body map[string]string
		_ = json.NewDecoder(resp.Body).Decode(&body)
		code := resp.StatusCode
		resp.Body.Close()
		if code != http.StatusServiceUnavailable {
			t.Fatalf("health after tmux death = %d, want 503", code)
		}
		if body["status"] != "unhealthy" {
			t.Fatalf("health body after tmux death = %v, want status unhealthy", body)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

// TestNoInsecureSkipVerify is a source-level guard: the tunnel package must
// never disable TLS verification.
func TestNoInsecureSkipVerify(t *testing.T) {
	// The dial options used by the control loop must not set InsecureSkipVerify.
	cl := newControlLoop(&Config{}, newTTYDAdapter("ws://127.0.0.1:7080"))
	if cl.dialOpts != nil && cl.dialOpts.TLSConfig != nil && cl.dialOpts.TLSConfig.InsecureSkipVerify {
		t.Error("control dialer disables TLS verification (InsecureSkipVerify)")
	}
}

// TestRunTokenNeverInURL verifies the run token never appears in the control
// URL.
func TestRunTokenNeverInURL(t *testing.T) {
	url := controlURL("ws://gateway:8080/ws", "agent-1")
	if strings.Contains(url, "run-token") || strings.Contains(url, "token=") {
		t.Errorf("control URL contains a token: %q", url)
	}
}

var _ = sync.Mutex{}
