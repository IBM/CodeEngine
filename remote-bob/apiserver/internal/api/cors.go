package api

import (
	"net/http"
	"strings"
)

// CORSMiddleware handles Cross-Origin Resource Sharing. Allowed origins are
// configurable via ALLOWED_ORIGINS (comma-separated); the default is the
// local development origins. Preflight (OPTIONS) requests are answered
// without authentication so the browser login flow works cross-origin.
type CORSMiddleware struct {
	allowedOrigins []string
}

// NewCORSMiddleware creates a CORS middleware from the environment.
func NewCORSMiddleware() *CORSMiddleware {
	return NewCORSMiddlewareWithOrigins(allowedOriginsFromEnv())
}

// NewCORSMiddlewareWithOrigins creates a CORS middleware with explicit origins.
func NewCORSMiddlewareWithOrigins(origins []string) *CORSMiddleware {
	return &CORSMiddleware{allowedOrigins: origins}
}

// AllowedOrigins returns the configured allowed origins.
func (m *CORSMiddleware) AllowedOrigins() []string {
	return m.allowedOrigins
}

// Wrap wraps an HTTP handler with CORS headers and preflight handling.
func (m *CORSMiddleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && m.originAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (m *CORSMiddleware) originAllowed(origin string) bool {
	for _, allowed := range m.allowedOrigins {
		if allowed == "*" || origin == allowed {
			return true
		}
	}
	return false
}

func allowedOriginsFromEnv() []string {
	originsEnv := getEnv("ALLOWED_ORIGINS")
	if originsEnv == "" {
		return []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			// The static browser client is loaded from file://, whose Origin
			// header is the literal string "null". Allow it so the login
			// fetch and WS connect work from a file:// page (VAL-BROWSER-048).
			"null",
		}
	}
	parts := strings.Split(originsEnv, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}
