package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// newTestServer builds a Server wired to a test mux with the middleware chain
// used in production (request logging, CORS, panic recovery). It returns the
// server and the httptest server URL.
func newTestServer(t *testing.T, password string, runKey []byte) (*Server, string) {
	t.Helper()
	srv := NewServer(Config{
		GatewayPassword: password,
		RunTokenKey:     runKey,
	})
	t.Cleanup(srv.Shutdown)

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)
	handler := NewRequestLogger(mux)
	handler = NewCORSMiddlewareWithOrigins([]string{"http://localhost:3000"}).Wrap(handler)
	handler = NewPanicRecovery(handler)

	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)
	return srv, ts.URL
}

func doRequest(t *testing.T, method, url string, headers map[string]string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	return resp
}

func decodeBody(t *testing.T, resp *http.Response) map[string]interface{} {
	t.Helper()
	defer resp.Body.Close()
	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	return body
}

// basicHeader builds a Basic Authorization header value.
func basicHeader(username, password string) string {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.SetBasicAuth(username, password)
	return req.Header.Get("Authorization")
}

func TestLogin_ValidCredentials(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	token, _ := body["token"].(string)
	if token == "" {
		t.Fatal("expected non-empty token in response")
	}
	if expires, ok := body["expires_in"].(float64); !ok || expires != 60 {
		t.Errorf("expected expires_in == 60, got %v", body["expires_in"])
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "wrong-password"),
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if _, ok := body["token"]; ok {
		t.Error("no token should be returned on failure")
	}
}

func TestLogin_MissingCredentials(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	// No Authorization header.
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing header, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Malformed header.
	resp = doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": "Basic not-base64!!!",
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for malformed header, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestLogin_WrongUsername(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("attacker", "test-password"),
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestLogin_ClearErrorMessage(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "wrong"),
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	msg, _ := body["message"].(string)
	if msg == "" {
		t.Error("expected a clear human-readable error message")
	}
}

func TestLogin_WrongUserAndWrongPassIndistinguishable(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	wrongUser := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("attacker", "test-password"),
	})
	wrongUserBody := decodeBody(t, wrongUser)

	wrongPass := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "wrong-password"),
	})
	wrongPassBody := decodeBody(t, wrongPass)

	if wrongUser.StatusCode != wrongPass.StatusCode {
		t.Errorf("status codes differ: %d vs %d", wrongUser.StatusCode, wrongPass.StatusCode)
	}
	if wrongUserBody["message"] != wrongPassBody["message"] {
		t.Errorf("messages differ: %v vs %v", wrongUserBody["message"], wrongPassBody["message"])
	}
}

func TestLogin_RepeatedFailuresDoNotCrashServer(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	for i := 0; i < 50; i++ {
		resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
			"Authorization": basicHeader("admin", "wrong"),
		})
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401, got %d", i, resp.StatusCode)
		}
		resp.Body.Close()
	}

	// A correct login still works.
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("correct login after failure burst: expected 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Health still responds.
	health := doRequest(t, http.MethodGet, ts+"/healthz", nil)
	if health.StatusCode != http.StatusOK {
		t.Errorf("healthz after failure burst: expected 200, got %d", health.StatusCode)
	}
	health.Body.Close()
}

func TestLogin_ConcurrentDistinctTokens(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	const n = 20
	var wg sync.WaitGroup
	tokens := make([]string, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
				"Authorization": basicHeader("admin", "test-password"),
			})
			if resp.StatusCode != http.StatusOK {
				t.Errorf("login %d: expected 200, got %d", i, resp.StatusCode)
				return
			}
			body := decodeBody(t, resp)
			tokens[i], _ = body["token"].(string)
		}(i)
	}
	wg.Wait()

	seen := make(map[string]bool)
	for _, token := range tokens {
		if token == "" {
			t.Fatal("a concurrent login returned an empty token")
		}
		if seen[token] {
			t.Fatal("concurrent logins returned duplicate tokens")
		}
		seen[token] = true
	}
}

func TestRuns_ValidCredentials(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	runToken, _ := body["run_token"].(string)
	if runToken == "" {
		t.Fatal("expected non-empty run_token in response")
	}
}

func TestRuns_WrongCredentials(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/runs?agent=agent-1", map[string]string{
		"Authorization": basicHeader("admin", "wrong"),
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if _, ok := body["run_token"]; ok {
		t.Error("no run_token should be returned on failure")
	}
}

func TestRuns_MissingAgentParam(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/runs", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing agent, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestAgents_RequiresBasicAuth(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	// No credentials -> 401.
	resp := doRequest(t, http.MethodGet, ts+"/agents", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without credentials, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Wrong credentials -> 401.
	resp = doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
		"Authorization": basicHeader("admin", "wrong"),
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 with wrong credentials, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Valid credentials -> 200 with a JSON array.
	resp = doRequest(t, http.MethodGet, ts+"/agents", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 with valid credentials, got %d", resp.StatusCode)
	}
	defer resp.Body.Close()
	var list []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		t.Fatalf("expected a JSON array: %v", err)
	}
}

func TestHealth_Public(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	for _, path := range []string{"/healthz", "/readyz"} {
		resp := doRequest(t, http.MethodGet, ts+path, nil)
		if resp.StatusCode != http.StatusOK {
			t.Errorf("%s without auth: expected 200, got %d", path, resp.StatusCode)
		}
		resp.Body.Close()
	}
}

func TestHealth_Stays200UnderConcurrentLoad(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
				"Authorization": basicHeader("admin", "test-password"),
			})
			if resp.StatusCode != http.StatusOK {
				t.Errorf("concurrent login: expected 200, got %d", resp.StatusCode)
			}
			resp.Body.Close()
		}()
	}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for _, path := range []string{"/healthz", "/readyz"} {
				resp := doRequest(t, http.MethodGet, ts+path, nil)
				if resp.StatusCode != http.StatusOK {
					t.Errorf("%s under load: expected 200, got %d", path, resp.StatusCode)
				}
				resp.Body.Close()
			}
		}()
	}
	wg.Wait()
}

func TestAuthEndpoints_RejectNonPost(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	for _, path := range []string{"/auth/login", "/auth/runs?agent=agent-1"} {
		for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
			resp := doRequest(t, method, ts+path, map[string]string{
				"Authorization": basicHeader("admin", "test-password"),
			})
			if resp.StatusCode != http.StatusMethodNotAllowed {
				t.Errorf("%s %s: expected 405, got %d", method, path, resp.StatusCode)
			}
			resp.Body.Close()
		}
	}
}

func TestAuth_FailsClosedWhenPasswordUnset(t *testing.T) {
	// Server started without GATEWAY_PASSWORD: login must not grant access.
	_, ts := newTestServer(t, "", testRunKey())

	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "anything"),
	})
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when GATEWAY_PASSWORD is unset, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if _, ok := body["token"]; ok {
		t.Error("no token should be issued when auth is not configured")
	}
}

func TestAuth_FailsClosedWhenPasswordEmpty(t *testing.T) {
	_, ts := newTestServer(t, "", testRunKey())

	// Even an empty password must not authenticate.
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", ""),
	})
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for empty GATEWAY_PASSWORD, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestCORS_PreflightToLoginSucceedsWithoutAuth(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	req, err := http.NewRequest(http.MethodOptions, ts+"/auth/login", nil)
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("preflight expected 2xx, got %d", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("Access-Control-Allow-Origin = %q", got)
	}
	allowHeaders := resp.Header.Get("Access-Control-Allow-Headers")
	if !strings.Contains(allowHeaders, "Authorization") || !strings.Contains(allowHeaders, "Content-Type") {
		t.Errorf("Access-Control-Allow-Headers = %q, want Authorization and Content-Type", allowHeaders)
	}
}

func TestCORS_DisallowedOriginRejected(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	req, err := http.NewRequest(http.MethodGet, ts+"/healthz", nil)
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	req.Header.Set("Origin", "http://evil.example.com")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()

	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want empty for disallowed origin", got)
	}
}

func TestPanicRecovery_Returns500(t *testing.T) {
	panicking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})
	handler := NewPanicRecovery(panicking)

	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 after panic, got %d", w.Code)
	}
}

func TestAgentByID_GetNotFound(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	// Unknown agent → 404.
	resp := doRequest(t, http.MethodGet, ts+"/agents/no-such-agent", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown agent, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if _, ok := body["error"]; !ok {
		t.Error("expected error field in 404 body")
	}
}

func TestAgentByID_GetFound(t *testing.T) {
	srv, ts := newTestServer(t, "test-password", testRunKey())

	// Register an agent with a service.
	conn := newTestWSConn(t)
	srv.AgentRegistry().Register("agent-x", conn)
	srv.AgentRegistry().SetServices("agent-x", []Service{{Name: "ttyd"}})

	resp := doRequest(t, http.MethodGet, ts+"/agents/agent-x", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for registered agent, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", body["status"])
	}
}

func TestAgentByID_GetShuttingDown(t *testing.T) {
	srv, ts := newTestServer(t, "test-password", testRunKey())

	// Register and immediately mark shutting down.
	conn := newTestWSConn(t)
	srv.AgentRegistry().Register("agent-y", conn)
	srv.AgentRegistry().SetServices("agent-y", []Service{{Name: "ttyd"}})
	srv.MarkShuttingDown()

	resp := doRequest(t, http.MethodGet, ts+"/agents/agent-y", nil)
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when shutting down, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if body["error"] != "shutting_down" {
		t.Errorf("expected error=shutting_down, got %v", body["error"])
	}
}

func TestAgentByID_GetRequiresNoAuth(t *testing.T) {
	srv, ts := newTestServer(t, "test-password", testRunKey())

	conn := newTestWSConn(t)
	srv.AgentRegistry().Register("agent-z", conn)
	srv.AgentRegistry().SetServices("agent-z", []Service{{Name: "ttyd"}})

	// No Authorization header — should still return 200.
	resp := doRequest(t, http.MethodGet, ts+"/agents/agent-z", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /agents/{id} should not require auth, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestAgentByID_DeleteRequiresAuth(t *testing.T) {
	srv, ts := newTestServer(t, "test-password", testRunKey())

	conn := newTestWSConn(t)
	srv.AgentRegistry().Register("agent-d", conn)
	srv.AgentRegistry().SetServices("agent-d", []Service{{Name: "ttyd"}})

	// No credentials.
	resp := doRequest(t, http.MethodDelete, ts+"/agents/agent-d", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("DELETE without auth: expected 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Wrong credentials.
	resp = doRequest(t, http.MethodDelete, ts+"/agents/agent-d", map[string]string{
		"Authorization": basicHeader("admin", "wrong"),
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("DELETE with wrong auth: expected 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestAgentByID_MethodNotAllowed(t *testing.T) {
	_, ts := newTestServer(t, "test-password", testRunKey())

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch} {
		resp := doRequest(t, method, ts+"/agents/some-id", map[string]string{
			"Authorization": basicHeader("admin", "test-password"),
		})
		if resp.StatusCode != http.StatusMethodNotAllowed {
			t.Errorf("%s /agents/id: expected 405, got %d", method, resp.StatusCode)
		}
		resp.Body.Close()
	}
}

func TestLogin_ShuttingDown_AfterIdleTimeout(t *testing.T) {
	// Simulate idle timeout: register agent, fire onEmpty → MarkShuttingDown.
	srv, ts := newTestServer(t, "test-password", testRunKey())

	fired := make(chan struct{})
	srv.AgentRegistry().SetOnEmpty(func() {
		srv.MarkShuttingDown()
		close(fired)
	})

	conn := newTestWSConn(t)
	srv.AgentRegistry().Register("agent-idle", conn)
	srv.AgentRegistry().SetServices("agent-idle", []Service{{Name: "ttyd"}})
	// Unregister simulates the agent disconnecting after idle timeout.
	srv.AgentRegistry().Unregister("agent-idle", conn)

	select {
	case <-fired:
	case <-time.After(time.Second):
		t.Fatal("onEmpty callback not fired within 1s")
	}

	// Login must now return 503 shutting_down.
	resp := doRequest(t, http.MethodPost, ts+"/auth/login", map[string]string{
		"Authorization": basicHeader("admin", "test-password"),
	})
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 after idle timeout, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if body["error"] != "shutting_down" {
		t.Errorf("expected error=shutting_down, got %v", body["error"])
	}
}

func TestAgentByID_GetGoneAfterIdleTimeout(t *testing.T) {
	// Simulate the full idle-timeout flow: browser probes GET /agents/{id}
	// after reconnect fails — must get 404 or 503, never 200 with a stale agent.
	srv, ts := newTestServer(t, "test-password", testRunKey())

	fired := make(chan struct{})
	srv.AgentRegistry().SetOnEmpty(func() {
		srv.MarkShuttingDown()
		close(fired)
	})

	conn := newTestWSConn(t)
	srv.AgentRegistry().Register("agent-idle2", conn)
	srv.AgentRegistry().SetServices("agent-idle2", []Service{{Name: "ttyd"}})
	srv.AgentRegistry().Unregister("agent-idle2", conn)

	select {
	case <-fired:
	case <-time.After(time.Second):
		t.Fatal("onEmpty not fired")
	}

	// GET /agents/{id} must return 503 (shutting_down) — not 200.
	resp := doRequest(t, http.MethodGet, ts+"/agents/agent-idle2", nil)
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 after idle timeout, got %d", resp.StatusCode)
	}
	body := decodeBody(t, resp)
	if body["error"] != "shutting_down" {
		t.Errorf("expected error=shutting_down, got %v", body["error"])
	}
}
