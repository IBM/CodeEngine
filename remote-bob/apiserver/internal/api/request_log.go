package api

import (
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/CodeEngine/remote-bob-apiserver/internal/log"
)

// credentialQueryParams are query parameters whose values must never be
// logged. The WS token on /ws/browser and the one-time relay token on
// /ws/relay are short-lived credentials; the run token must never appear in
// a URL at all, but if it ever does it is redacted too. Keys are matched
// case-insensitively.
var credentialQueryParams = map[string]bool{
	"token":        true,
	"relaytoken":   true,
	"relay_token":  true,
	"runtoken":     true,
	"run_token":    true,
	"password":     true,
	"sessiontoken": true,
}

// redactQuery returns a copy of the raw query string with credential-bearing
// parameter values replaced by "[REDACTED]". Keys are emitted in sorted order
// for deterministic output.
func redactQuery(rawQuery string) string {
	if rawQuery == "" {
		return ""
	}
	values, err := url.ParseQuery(rawQuery)
	if err != nil {
		// Fall back to a conservative redaction: drop the query entirely.
		return "[REDACTED]"
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(values))
	for _, key := range keys {
		vals := values[key]
		if credentialQueryParams[strings.ToLower(key)] {
			for range vals {
				parts = append(parts, key+"=[REDACTED]")
			}
			continue
		}
		for _, v := range vals {
			parts = append(parts, key+"="+v)
		}
	}
	return strings.Join(parts, "&")
}

// redactAuthorization returns a safe description of the Authorization header.
// The credential value (Basic password or Bearer token) is never logged.
func redactAuthorization(header string) string {
	if header == "" {
		return ""
	}
	space := strings.Index(header, " ")
	if space <= 0 {
		return "[REDACTED]"
	}
	scheme := header[:space]
	return scheme + " [REDACTED]"
}

// requestLogger logs every request with full credential redaction: the
// Authorization header value, credential query parameters, and credential
// body fields are never written to the log.
type requestLogger struct {
	next http.Handler
}

// NewRequestLogger wraps a handler with redacted request logging.
func NewRequestLogger(next http.Handler) http.Handler {
	return &requestLogger{next: next}
}

func (l *requestLogger) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	log.Info("http_request", map[string]interface{}{
		"method": r.Method,
		"path":   r.URL.Path,
		"query":  redactQuery(r.URL.RawQuery),
		"remote": r.RemoteAddr,
		"auth":   redactAuthorization(r.Header.Get("Authorization")),
	})
	l.next.ServeHTTP(w, r)
}
