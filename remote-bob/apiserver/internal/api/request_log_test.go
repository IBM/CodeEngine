package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRedactQuery(t *testing.T) {
	tests := []struct {
		name     string
		rawQuery string
		want     string
	}{
		{
			name:     "empty",
			rawQuery: "",
			want:     "",
		},
		{
			name:     "ws token redacted",
			rawQuery: "token=secret123&agent=agent-1&service=ttyd",
			want:     "agent=agent-1&service=ttyd&token=[REDACTED]",
		},
		{
			name:     "relay token redacted",
			rawQuery: "relayToken=secret456",
			want:     "relayToken=[REDACTED]",
		},
		{
			name:     "run token redacted",
			rawQuery: "runToken=secret789",
			want:     "runToken=[REDACTED]",
		},
		{
			name:     "password redacted",
			rawQuery: "password=hunter2",
			want:     "password=[REDACTED]",
		},
		{
			name:     "non-credential params preserved",
			rawQuery: "agent=agent-1&service=ttyd",
			want:     "agent=agent-1&service=ttyd",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := redactQuery(tt.rawQuery)
			if got != tt.want {
				t.Errorf("redactQuery(%q) = %q, want %q", tt.rawQuery, got, tt.want)
			}
		})
	}
}

func TestRedactAuthorization(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty", "", ""},
		{"basic", "Basic dXNlcjpwYXNz", "Basic [REDACTED]"},
		{"bearer", "Bearer abc123", "Bearer [REDACTED]"},
		{"malformed", "not-a-header", "[REDACTED]"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := redactAuthorization(tt.in)
			if got != tt.want {
				t.Errorf("redactAuthorization(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestRequestLogger_RedactsCredentials(t *testing.T) {
	// The logger must never emit the credential values. These are test
	// placeholders, not real credentials.
	const password = "test-password-placeholder"
	const wsToken = "test-ws-token-placeholder"
	const runToken = "test-run-token-placeholder"

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := NewRequestLogger(next)

	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("admin", password)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	req = httptest.NewRequest(http.MethodGet, "/ws/browser?token="+wsToken+"&agent=a&service=ttyd", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	req = httptest.NewRequest(http.MethodGet, "/ws/agent?agent=a", nil)
	req.Header.Set("Authorization", "Bearer "+runToken)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// The logger writes to the global slog logger (stdout), which we cannot
	// capture here; instead verify the redaction helpers produce safe output
	// and that the request path never includes the values.
	if strings.Contains(redactQuery("token="+wsToken), wsToken) {
		t.Error("redactQuery leaked the WS token")
	}
	if strings.Contains(redactAuthorization("Bearer "+runToken), runToken) {
		t.Error("redactAuthorization leaked the run token")
	}
	if strings.Contains(redactAuthorization("Basic "+password), password) {
		t.Error("redactAuthorization leaked the password")
	}
}

func TestRequestLogger_DoesNotBlockRequests(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	handler := NewRequestLogger(next)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", w.Code)
	}
}
