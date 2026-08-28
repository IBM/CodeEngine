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

// newWSServer builds a Server with only the WS routes registered (no
// middleware) and returns the server plus a ws:// base URL.
func newWSServer(t *testing.T, password string, runKey []byte) (*Server, string) {
	t.Helper()
	srv := NewServer(Config{
		GatewayPassword: password,
		RunTokenKey:     runKey,
	})
	t.Cleanup(srv.Shutdown)

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)
	ts := httptest.NewServer(mux)
	t.Cleanup(ts.Close)
	return srv, "ws" + strings.TrimPrefix(ts.URL, "http")
}

// dialWS attempts a WebSocket dial and returns the connection, the HTTP
// response (for rejected-upgrade checks), and any error.
// When the server rejects the upgrade, conn is nil and resp carries the HTTP status.
func dialWS(t *testing.T, rawURL string, headers map[string]string) (*ws.Conn, *http.Response, error) {
	t.Helper()
	res, err := ws.DialFull(rawURL, ws.DialHeader(headers))
	return res.Conn, res.Response, err
}

// registerTestAgent dials /ws/agent with a valid run token and sends a
// register control message. It returns the control connection.
// A background goroutine reads from the conn so that Done() fires when the
// server side closes the connection (e.g. on replacement).
func registerTestAgent(t *testing.T, wsBase, runToken, agentID string, services []Service) *ws.Conn {
	t.Helper()
	conn, resp, err := dialWS(t, wsBase+"/ws/agent?agent="+agentID, map[string]string{
		"Authorization": "Bearer " + runToken,
	})
	if err != nil {
		t.Fatalf("agent dial failed: %v (resp %v)", err, resp)
	}
	msg, _ := json.Marshal(map[string]interface{}{
		"type":     "register",
		"services": services,
	})
	if err := conn.WriteFrame(ws.MsgText, msg); err != nil {
		t.Fatalf("register write failed: %v", err)
	}
	return conn
}

func TestAgentWS_NoAuthorizationRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	_, resp, err := dialWS(t, wsBase+"/ws/agent?agent=agent-1", nil)
	if err == nil {
		t.Fatal("expected dial to fail without Authorization header")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %v", resp)
	}
}

func TestAgentWS_InvalidRunTokenRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	_, resp, err := dialWS(t, wsBase+"/ws/agent?agent=agent-1", map[string]string{
		"Authorization": "Bearer garbage-token",
	})
	if err == nil {
		t.Fatal("expected dial to fail with invalid run token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %v", resp)
	}
}

func TestAgentWS_ValidRunTokenRegisters(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	// Issue a run token via the REST endpoint.
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	runToken, _ := body["run_token"].(string)
	if runToken == "" {
		t.Fatal("no run token issued")
	}

	conn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd", Upstream: "ws://127.0.0.1:7080"}})
	defer conn.Close()

	// The register control message is processed asynchronously; poll until
	// the agent appears in GET /agents.
	var agents []AgentInfo
	deadline := time.Now().Add(2 * time.Second)
	for {
		agentsResp := doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
			"Authorization": basicHeader("admin", "test-password"),
		})
		agents = nil
		if err := json.NewDecoder(agentsResp.Body).Decode(&agents); err != nil {
			agentsResp.Body.Close()
			t.Fatalf("decode agents: %v", err)
		}
		agentsResp.Body.Close()
		found := false
		for _, a := range agents {
			if a.AgentID == "agent-1" && len(a.Services) == 1 {
				found = true
			}
		}
		if found {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("agent-1 did not appear in GET /agents with services in time")
		}
		time.Sleep(10 * time.Millisecond)
	}

	found := false
	for _, a := range agents {
		if a.AgentID == "agent-1" {
			found = true
			if a.Status != "ready" {
				t.Errorf("agent status = %q, want ready", a.Status)
			}
			if len(a.Services) != 1 || a.Services[0] != "ttyd" {
				t.Errorf("agent services = %v, want [ttyd]", a.Services)
			}
		}
	}
	if !found {
		t.Error("agent-1 not listed in GET /agents")
	}
}

func TestAgentWS_CrossAgentUseRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-A", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	runToken, _ := body["run_token"].(string)
	if runToken == "" {
		t.Fatal("no run token issued")
	}

	// Use agent A's token with agent=B: must be rejected and B not registered.
	_, dialResp, err := dialWS(t, wsBase+"/ws/agent?agent=agent-B", map[string]string{
		"Authorization": "Bearer " + runToken,
	})
	if err == nil {
		t.Fatal("expected cross-agent dial to fail")
	}
	if dialResp == nil || dialResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for cross-agent use, got %v", dialResp)
	}

	agentsResp := doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	defer agentsResp.Body.Close()
	var agents []AgentInfo
	if err := json.NewDecoder(agentsResp.Body).Decode(&agents); err != nil {
		t.Fatalf("decode agents: %v", err)
	}
	for _, a := range agents {
		if a.AgentID == "agent-B" {
			t.Error("agent-B must not be registered after cross-agent token use")
		}
	}
}

func TestAgentWS_SecondConnectionReplacesFirst(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	runToken, _ := body["run_token"].(string)

	conn1 := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer conn1.Close()

	// Second connection with the same agent ID replaces the first.
	conn2 := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer conn2.Close()

	// The first connection should be closed by the registry — Done fires.
	waitConnDone(t, conn1, "first control connection should be closed after replacement")

	// The agent is registered exactly once.
	if srv.AgentRegistry().Count() != 1 {
		t.Errorf("expected exactly 1 registered agent, got %d", srv.AgentRegistry().Count())
	}
}

func TestAgentWS_ControlDropUnregisters(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	runToken, _ := body["run_token"].(string)

	conn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	if !srv.AgentRegistry().Has("agent-1") {
		t.Fatal("agent should be registered")
	}
	conn.Close()

	// Wait for the handler to unregister.
	deadline := time.Now().Add(2 * time.Second)
	for srv.AgentRegistry().Has("agent-1") && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if srv.AgentRegistry().Has("agent-1") {
		t.Error("agent should be unregistered after control connection close")
	}
}

func TestBrowserWS_NoTokenRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	_, resp, err := dialWS(t, wsBase+"/ws/browser?agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("expected dial to fail without token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %v", resp)
	}
}

func TestBrowserWS_InvalidTokenRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	_, resp, err := dialWS(t, wsBase+"/ws/browser?token=garbage&agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("expected dial to fail with invalid token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %v", resp)
	}
}

func TestBrowserWS_SingleUse(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	token, _ := body["token"].(string)

	// First use: token is consumed even though the agent lookup fails.
	_, firstResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=unknown&service=ttyd", nil)
	if err == nil {
		t.Fatal("expected dial to fail for unknown agent")
	}
	if firstResp == nil || firstResp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 for unknown agent, got %v", firstResp)
	}

	// Second use of the same token must be rejected (single-use).
	_, secondResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=unknown&service=ttyd", nil)
	if err == nil {
		t.Fatal("expected second use of the same token to fail")
	}
	if secondResp == nil || secondResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for second use, got %v", secondResp)
	}
}

func TestBrowserWS_ExpiredTokenRejected(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())
	_ = srv

	// Issue a token, then force expiry by advancing the store clock.
	now := time.Now()
	srv.wsTokens.now = func() time.Time { return now }
	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	token, _ := body["token"].(string)

	srv.wsTokens.now = func() time.Time { return now.Add(61 * time.Second) }

	_, dialResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("expected expired token dial to fail")
	}
	if dialResp == nil || dialResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired token, got %v", dialResp)
	}
}

func TestBrowserWS_UnknownAgentRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	token, _ := body["token"].(string)

	_, dialResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=unknown&service=ttyd", nil)
	if err == nil {
		t.Fatal("expected dial to fail for unknown agent")
	}
	if dialResp == nil || dialResp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 for unknown agent, got %v", dialResp)
	}
}

func TestBrowserWS_UnknownServiceRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	runToken, _ := body["run_token"].(string)

	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()

	loginResp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	loginBody := decodeBody(t, loginResp)
	token, _ := loginBody["token"].(string)

	_, dialResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=agent-1&service=doesnotexist", nil)
	if err == nil {
		t.Fatal("expected dial to fail for unknown service")
	}
	if dialResp == nil || dialResp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 for unknown service, got %v", dialResp)
	}
}

func TestBrowserWS_ValidTokenConnects(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")
	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	runToken, _ := body["run_token"].(string)

	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()

	loginResp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	loginBody := decodeBody(t, loginResp)
	token, _ := loginBody["token"].(string)

	conn, dialResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=agent-1&service=ttyd", nil)
	if err != nil {
		t.Fatalf("expected valid browser dial to succeed: %v (resp %v)", err, dialResp)
	}
	defer conn.Close()
	if dialResp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("expected 101, got %d", dialResp.StatusCode)
	}
}

func TestBrowserWS_ConcurrentSameTokenRaceSafe(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	// Register an agent so a successful dial can actually complete.
	runResp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	runBody := decodeBody(t, runResp)
	runToken, _ := runBody["run_token"].(string)
	agentConn := registerTestAgent(t, wsBase, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer agentConn.Close()

	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	body := decodeBody(t, resp)
	token, _ := body["token"].(string)

	const n = 10
	var wg sync.WaitGroup
	successes := make([]bool, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			conn, dialResp, err := dialWS(t, wsBase+"/ws/browser?token="+token+"&agent=agent-1&service=ttyd", nil)
			if err == nil {
				conn.Close()
				successes[i] = true
				return
			}
			_ = dialResp
		}(i)
	}
	wg.Wait()

	successCount := 0
	for _, ok := range successes {
		if ok {
			successCount++
		}
	}
	if successCount != 1 {
		t.Errorf("exactly one concurrent browser connect should succeed, got %d", successCount)
	}
}

func TestCredentialTypeSeparation(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	ts := "http" + strings.TrimPrefix(wsBase, "ws")

	// Get a WS token.
	loginResp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	loginBody := decodeBody(t, loginResp)
	wsToken, _ := loginBody["token"].(string)

	// Get a run token.
	runResp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	runBody := decodeBody(t, runResp)
	runToken, _ := runBody["run_token"].(string)

	// WS token on /ws/agent must be rejected.
	_, agentResp, err := dialWS(t, wsBase+"/ws/agent?agent=agent-1", map[string]string{
		"Authorization": "Bearer " + wsToken,
	})
	if err == nil {
		t.Fatal("WS token must be rejected on /ws/agent")
	}
	if agentResp == nil || agentResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for WS token on /ws/agent, got %v", agentResp)
	}

	// Run token on /ws/browser must be rejected.
	_, browserResp, err := dialWS(t, wsBase+"/ws/browser?token="+runToken+"&agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("run token must be rejected on /ws/browser")
	}
	if browserResp == nil || browserResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for run token on /ws/browser, got %v", browserResp)
	}
}

func TestRestartInvalidatesWSTokensButNotRunTokens(t *testing.T) {
	// Simulate a restart: a fresh server with the same run-token key.
	key := testRunKey()

	srv1, wsBase1 := newWSServer(t, "test-password", key)
	ts1 := "http" + strings.TrimPrefix(wsBase1, "ws")

	loginResp := doRequest(t, http.MethodPost, ts1+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	loginBody := decodeBody(t, loginResp)
	wsToken, _ := loginBody["token"].(string)

	runResp := doRequest(t, http.MethodPost, ts1+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	runBody := decodeBody(t, runResp)
	runToken, _ := runBody["run_token"].(string)

	// "Restart": stop the old server and start a new one with the same key.
	srv1.Shutdown()

	srv2, wsBase2 := newWSServer(t, "test-password", key)
	_ = srv2

	// Pre-restart WS token is rejected.
	_, wsResp, err := dialWS(t, wsBase2+"/ws/browser?token="+wsToken+"&agent=agent-1&service=ttyd", nil)
	if err == nil {
		t.Fatal("pre-restart WS token must be rejected after restart")
	}
	if wsResp == nil || wsResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for pre-restart WS token, got %v", wsResp)
	}

	// Pre-restart run token still registers an agent.
	conn := registerTestAgent(t, wsBase2, runToken, "agent-1", []Service{{Name: "ttyd"}})
	defer conn.Close()

	ts2 := "http" + strings.TrimPrefix(wsBase2, "ws")
	agentsResp := doRequest(t, http.MethodGet, ts2+"/agents", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	defer agentsResp.Body.Close()
	var agents []AgentInfo
	if err := json.NewDecoder(agentsResp.Body).Decode(&agents); err != nil {
		t.Fatalf("decode agents: %v", err)
	}
	found := false
	for _, a := range agents {
		if a.AgentID == "agent-1" {
			found = true
		}
	}
	if !found {
		t.Error("pre-restart run token should still register the agent after restart")
	}
}

func TestRelayWS_NoTokenRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	_, resp, err := dialWS(t, wsBase+"/ws/relay", nil)
	if err == nil {
		t.Fatal("expected dial to fail without relay token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %v", resp)
	}
}

func TestRelayWS_InvalidTokenRejected(t *testing.T) {
	_, wsBase := newWSServer(t, "test-password", testRunKey())

	_, resp, err := dialWS(t, wsBase+"/ws/relay?relayToken=garbage", nil)
	if err == nil {
		t.Fatal("expected dial to fail with invalid relay token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %v", resp)
	}
}

func TestRelayWS_OneTimeToken(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())

	relayToken, err := srv.relayTokens.Issue()
	if err != nil {
		t.Fatalf("Issue relay token: %v", err)
	}

	// First use succeeds.
	conn, resp, err := dialWS(t, wsBase+"/ws/relay?relayToken="+relayToken, nil)
	if err != nil {
		t.Fatalf("first relay dial should succeed: %v (resp %v)", err, resp)
	}
	conn.Close()

	// Second use is rejected (one-time).
	_, resp2, err := dialWS(t, wsBase+"/ws/relay?relayToken="+relayToken, nil)
	if err == nil {
		t.Fatal("second relay dial with the same token must fail")
	}
	if resp2 == nil || resp2.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for second relay use, got %v", resp2)
	}
}

func TestRelayWS_OneTimeEvenAfterFailedDial(t *testing.T) {
	srv, wsBase := newWSServer(t, "test-password", testRunKey())

	relayToken, err := srv.relayTokens.Issue()
	if err != nil {
		t.Fatalf("Issue relay token: %v", err)
	}

	// First dial attempt: token is consumed server-side even if the connection fails.
	// Use dialWS with extra headers that might cause issues — but the token gets consumed.
	_, _, _ = dialWS(t, wsBase+"/ws/relay?relayToken="+relayToken, map[string]string{
		"Sec-WebSocket-Protocol": "invalid",
	})

	// A second dial with the same token must still be rejected.
	_, resp2, err := dialWS(t, wsBase+"/ws/relay?relayToken="+relayToken, nil)
	if err == nil {
		t.Fatal("relay token must be single-use even after a failed first dial")
	}
	if resp2 == nil || resp2.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %v", resp2)
	}
}
