package api

import (
	"crypto/subtle"
	"net/http"
)

const (
	gatewayUsername = "admin"
	authRealm       = "Remote Bob Gateway"
)

// BasicAuth validates HTTP Basic credentials against GATEWAY_PASSWORD. It
// fails closed: when no password is configured, every request is rejected
// with 503 rather than being allowed through.
type BasicAuth struct {
	password string
}

// NewBasicAuth creates a BasicAuth checker.
func NewBasicAuth(password string) *BasicAuth {
	return &BasicAuth{password: password}
}

// Check validates the request's Basic credentials. On failure it writes the
// error response and returns false. Wrong username and wrong password produce
// identical responses to prevent user enumeration.
func (a *BasicAuth) Check(w http.ResponseWriter, r *http.Request) bool {
	if a.password == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "authentication_not_configured",
			"message": "server authentication is not configured",
		})
		return false
	}
	username, password, ok := r.BasicAuth()
	if !ok {
		a.unauthorized(w)
		return false
	}
	userOK := subtle.ConstantTimeCompare([]byte(username), []byte(gatewayUsername)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(password), []byte(a.password)) == 1
	if !userOK || !passOK {
		a.unauthorized(w)
		return false
	}
	return true
}

func (a *BasicAuth) unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Basic realm="`+authRealm+`"`)
	writeJSON(w, http.StatusUnauthorized, map[string]string{
		"error":   "authentication_failed",
		"message": "invalid credentials",
	})
}
