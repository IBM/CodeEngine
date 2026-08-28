package tunnel

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/CodeEngine/remote-bob-job-agent/internal/log"
)

// healthState tracks tmux readiness for the health endpoint.
type healthState struct {
	mu        sync.RWMutex
	tmuxReady bool
}

func (h *healthState) setTmuxReady(ready bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.tmuxReady = ready
}

func (h *healthState) isTmuxReady() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.tmuxReady
}

// healthHandler returns the health response for the current tmux readiness:
// 200 {"status":"healthy"} when tmux is ready, 503 {"status":"unhealthy"}
// otherwise. It is a pure function of the health state so tests can assert
// the 503 transition without a live server.
func healthHandler(cfg *Config, state *healthState, w http.ResponseWriter) {
	status := http.StatusOK
	body := map[string]string{"status": "healthy", "agent": cfg.AgentID}
	if !state.isTmuxReady() {
		status = http.StatusServiceUnavailable
		body["status"] = "unhealthy"
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// serveHealth runs the health server bound to 127.0.0.1:HEALTH_PORT. It
// returns 200 {"status":"healthy"} only when tmux is ready, and 503
// {"status":"unhealthy"} otherwise.
func serveHealth(ctx context.Context, cfg *Config, state *healthState) error {
	mux := http.NewServeMux()
	handleHealth := func(w http.ResponseWriter, r *http.Request) {
		healthHandler(cfg, state, w)
	}
	mux.HandleFunc("/", handleHealth)
	mux.HandleFunc("/health", handleHealth)
	server := &http.Server{Addr: "127.0.0.1:" + cfg.HealthPort, Handler: mux}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	log.Info("health_server_started", map[string]interface{}{
		"addr": "127.0.0.1:" + cfg.HealthPort,
	})
	return server.ListenAndServe()
}
