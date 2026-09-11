package api

import (
	"net/http"

	"github.com/CodeEngine/remote-bob-apiserver/internal/log"
)

// panicRecovery wraps a handler so that a panic in any handler returns a 500
// instead of crashing the server.
type panicRecovery struct {
	next http.Handler
}

// NewPanicRecovery wraps a handler with panic recovery.
func NewPanicRecovery(next http.Handler) http.Handler {
	return &panicRecovery{next: next}
}

func (p *panicRecovery) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Error("http_handler_panic", nil,
				"method", r.Method,
				"path", r.URL.Path,
				"panic", rec)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	}()
	p.next.ServeHTTP(w, r)
}
