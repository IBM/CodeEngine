package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORS_AllowsConfiguredOrigin(t *testing.T) {
	mw := NewCORSMiddlewareWithOrigins([]string{"http://localhost:3000"})
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "http://localhost:3000")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestCORS_RejectsDisallowedOrigin(t *testing.T) {
	mw := NewCORSMiddlewareWithOrigins([]string{"http://localhost:3000"})
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "http://evil.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want empty for disallowed origin", got)
	}
}

func TestCORS_PreflightSucceedsWithoutAuth(t *testing.T) {
	mw := NewCORSMiddlewareWithOrigins([]string{"http://localhost:3000"})
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("next handler must not be called for preflight")
	}))

	req := httptest.NewRequest(http.MethodOptions, "/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("preflight should return 2xx, got %d", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("preflight Access-Control-Allow-Origin = %q", got)
	}
}

func TestCORS_AllowHeadersIncludesAuthorizationAndContentType(t *testing.T) {
	mw := NewCORSMiddlewareWithOrigins([]string{"http://localhost:3000"})
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	allowHeaders := w.Header().Get("Access-Control-Allow-Headers")
	if !strings.Contains(allowHeaders, "Authorization") {
		t.Errorf("Access-Control-Allow-Headers = %q, want it to include Authorization", allowHeaders)
	}
	if !strings.Contains(allowHeaders, "Content-Type") {
		t.Errorf("Access-Control-Allow-Headers = %q, want it to include Content-Type", allowHeaders)
	}
}

func TestCORS_DefaultOrigins(t *testing.T) {
	mw := NewCORSMiddlewareWithOrigins(allowedOriginsFromEnv())
	if len(mw.AllowedOrigins()) == 0 {
		t.Fatal("default CORS middleware should have at least one allowed origin")
	}
}

func TestCORS_AllowsNullOrigin(t *testing.T) {
	// The static browser client is loaded from file://, whose Origin header
	// is the literal string "null". The login fetch and WS connect must work
	// from a file:// page (VAL-BROWSER-048).
	mw := NewCORSMiddlewareWithOrigins(allowedOriginsFromEnv())
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.Header.Set("Origin", "null")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "null" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q for file:// (null) origin", got, "null")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestCORS_WildcardAllowsAnyOrigin(t *testing.T) {
	mw := NewCORSMiddlewareWithOrigins([]string{"*"})
	handler := mw.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "http://anything.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://anything.example.com" {
		t.Errorf("Access-Control-Allow-Origin = %q, want the request origin", got)
	}
}
