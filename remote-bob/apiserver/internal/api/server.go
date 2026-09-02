package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/CodeEngine/remote-bob-apiserver/internal/log"
	"github.com/CodeEngine/remote-bob-apiserver/internal/ws"
)

const (
	defaultWSTokenTTL    = 60 * time.Second
	defaultRunTokenTTL   = 24 * time.Hour
	defaultRelayTokenTTL = 60 * time.Second
	defaultRelayOpenWait = 10 * time.Second
)

// Server is the apiserver: a thin authenticated relay with an in-memory agent
// registry and token stores. It has no session management and no persistence.
type Server struct {
	basicAuth        *BasicAuth
	wsTokens         *WSTokenStore
	runTokens        *RunTokenManager
	relayTokens      *RelayTokenStore
	agentRegistry    *AgentRegistry
	relays           *relayManager
	wsTokenTTL       time.Duration
	relayOpenTimeout time.Duration
	// shuttingDown is set to 1 atomically when a DELETE /agents/{id} is
	// processed. New browser WS connections and logins are rejected with 503
	// so the browser shows "shutting down" rather than reconnecting.
	shuttingDown atomic.Int32
	// shutdownCh is closed by MarkShuttingDown so main.go can select on it
	// alongside the OS signal channel. Using a channel (rather than SIGTERM)
	// ensures the process stays alive until all in-flight 4001 close frames
	// have been delivered to job-agents before httpServer.Shutdown runs.
	shutdownCh   chan struct{}
	shutdownOnce sync.Once
	// agentWG tracks active handleAgentWS goroutines. WaitAgentsDone blocks
	// until all of them have returned, ensuring every queued 4001 close frame
	// has been sent before the process exits.
	agentWG sync.WaitGroup
}

// Config holds server configuration.
type Config struct {
	GatewayPassword  string
	RunTokenKey      []byte
	WSTokenTTL       time.Duration
	RunTokenTTL      time.Duration
	RelayTokenTTL    time.Duration
	RelayOpenTimeout time.Duration
}

// NewServer creates a new apiserver.
func NewServer(cfg Config) *Server {
	if cfg.WSTokenTTL == 0 {
		cfg.WSTokenTTL = defaultWSTokenTTL
	}
	if cfg.RunTokenTTL == 0 {
		cfg.RunTokenTTL = defaultRunTokenTTL
	}
	if cfg.RelayTokenTTL == 0 {
		cfg.RelayTokenTTL = defaultRelayTokenTTL
	}
	if cfg.RelayOpenTimeout == 0 {
		cfg.RelayOpenTimeout = defaultRelayOpenWait
	}

	relayTokenStore := NewRelayTokenStore(cfg.RelayTokenTTL)
	return &Server{
		basicAuth:        NewBasicAuth(cfg.GatewayPassword),
		wsTokens:         NewWSTokenStore(cfg.WSTokenTTL),
		runTokens:        NewRunTokenManager(cfg.RunTokenKey, cfg.RunTokenTTL),
		relayTokens:      relayTokenStore,
		agentRegistry:    NewAgentRegistry(),
		relays:           newRelayManager(relayTokenStore.Revoke),
		wsTokenTTL:       cfg.WSTokenTTL,
		relayOpenTimeout: cfg.RelayOpenTimeout,
		shutdownCh:       make(chan struct{}),
	}
}

// Shutdown stops background goroutines and closes agent connections and
// active relays. It also marks the server as shutting down so any concurrent
// login or browser-WS requests during the graceful-shutdown window get a
// 503 "shutting_down" response instead of looping on "Connection failed".
func (s *Server) Shutdown() {
	s.shuttingDown.Store(1)
	s.wsTokens.Stop()
	s.relayTokens.Stop()
	s.relays.closeAll()
	s.agentRegistry.Close()
}

// AgentRegistry exposes the registry (used by tests and the relay feature).
func (s *Server) AgentRegistry() *AgentRegistry {
	return s.agentRegistry
}

// MarkShuttingDown marks the server as shutting down. Any subsequent login
// or browser-WS request returns 503 "shutting_down". It also closes
// ShutdownCh so main.go can begin the graceful-shutdown sequence without
// depending on SIGTERM delivery timing.
func (s *Server) MarkShuttingDown() {
	s.shuttingDown.Store(1)
	s.shutdownOnce.Do(func() { close(s.shutdownCh) })
}

// ShutdownCh returns a channel that is closed when MarkShuttingDown is called.
// main.go selects on this alongside the OS signal channel so it can start
// graceful shutdown as soon as the last agent disconnects, without relying on
// SIGTERM being delivered and processed before the 4001 close frames are sent.
func (s *Server) ShutdownCh() <-chan struct{} {
	return s.shutdownCh
}

// WaitAgentsDone blocks until all active handleAgentWS goroutines have
// returned. Call this after ShutdownCh fires and before httpServer.Shutdown so
// every queued 4001 close frame has been flushed to the job-agent.
func (s *Server) WaitAgentsDone() {
	s.agentWG.Wait()
}

// RegisterRoutes registers all HTTP and WebSocket routes.
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/auth/login", s.handleLogin)
	mux.HandleFunc("/auth/runs", s.handleRuns)
	mux.HandleFunc("/agents", s.handleAgents)
	mux.HandleFunc("/agents/", s.handleAgentByID)
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/readyz", s.handleHealth)
	mux.HandleFunc("/ws/agent", s.handleAgentWS)
	mux.HandleFunc("/ws/browser", s.handleBrowserWS)
	mux.HandleFunc("/ws/relay", s.handleRelayWS)
}

// handleLogin issues a 60s single-use WS token in exchange for valid Basic
// credentials.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.shuttingDown.Load() != 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "shutting_down",
			"message": "Session is shutting down",
		})
		return
	}
	if !s.basicAuth.Check(w, r) {
		return
	}
	token, err := s.wsTokens.Issue()
	if err != nil {
		log.Error("ws_token_issue_failed", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "token_issue_failed",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":      token,
		"expires_in": int(s.wsTokenTTL.Seconds()),
	})
}

// handleRuns issues a stateless HMAC run token bound to the requested agent.
func (s *Server) handleRuns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !s.basicAuth.Check(w, r) {
		return
	}
	agentID := r.URL.Query().Get("agent")
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "agent_required",
			"message": "agent query parameter is required",
		})
		return
	}
	token, err := s.runTokens.Issue(agentID)
	if err != nil {
		log.Error("run_token_issue_failed", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "token_issue_failed",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"run_token": token,
	})
}

// handleAgents lists registered agents (Basic auth required).
func (s *Server) handleAgents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !s.basicAuth.Check(w, r) {
		return
	}
	writeJSON(w, http.StatusOK, s.agentRegistry.List())
}

// handleAgentByID handles requests on /agents/{id}.
//
//	GET    /agents/{id} — check whether the agent is registered (no auth required
//	                      since it reveals no sensitive information, only existence).
//	DELETE /agents/{id} — terminate the agent (Basic auth required).
func (s *Server) handleAgentByID(w http.ResponseWriter, r *http.Request) {
	agentID := strings.TrimPrefix(r.URL.Path, "/agents/")
	if agentID == "" {
		http.Error(w, "agent id required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		// Browser uses this to probe whether the agent is still alive after a
		// failed /ws/browser connect. Returns 200 if found, 404 if not found,
		// 503 if the server is shutting down.
		if s.shuttingDown.Load() != 0 {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error":   "shutting_down",
				"message": "Session is shutting down",
			})
			return
		}
		if !s.agentRegistry.Has(agentID) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})

	case http.MethodDelete:
		if !s.basicAuth.Check(w, r) {
			return
		}
		// Mark server as shutting down before disconnecting so any concurrent
		// browser reconnect attempts see 503 immediately.
		s.MarkShuttingDown()
		found := s.agentRegistry.Disconnect(agentID)
		if !found {
			// Agent already gone — still stay in shutting-down state.
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleHealth is the public liveness/readiness probe.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleAgentWS is the agent control connection. It requires a valid run
// token bound to the agent ID in the Authorization: Bearer header.
func (s *Server) handleAgentWS(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agent")
	if agentID == "" {
		http.Error(w, "agent is required", http.StatusBadRequest)
		return
	}
	token := bearerToken(r.Header.Get("Authorization"))
	if token == "" {
		http.Error(w, "Authorization: Bearer <run_token> header is required", http.StatusUnauthorized)
		return
	}
	if !s.runTokens.Validate(token, agentID) {
		http.Error(w, "Invalid run token", http.StatusUnauthorized)
		return
	}

	conn, err := ws.Upgrade(w, r)
	if err != nil {
		log.Error("agent_ws_upgrade_failed", err, "agent_id", agentID)
		return
	}

	// Track this goroutine so WaitAgentsDone can block until the 4001 close
	// frame has been sent and the connection fully closed.
	s.agentWG.Add(1)
	defer s.agentWG.Done()

	terminateCh := s.agentRegistry.Register(agentID, conn)
	defer s.agentRegistry.Unregister(agentID, conn)
	// If this control connection is replaced or drops, every relay opened on
	// it is torn down (control-connection replacement semantics).
	defer s.relays.closeAgent(agentID, conn)
	log.Info("agent_ws_connected", "agent_id", agentID)

	// Watch for deliberate termination (DELETE /agents/{id}). When the
	// terminateCh is closed, send WS close code 4001 to the job-agent and
	// close the connection to unblock the read loop below. The write goes
	// through the relayManager's per-connection mutex to serialise it with
	// any concurrent relay-open writes on the same connection.
	go func() {
		<-terminateCh
		closeFrame := buildCloseFrame(closeCodeAgentTerminated, "terminated by request")
		s.relays.sendRawFrame(conn, ws.MsgClose, closeFrame)
		conn.Close()
	}()

	for {
		f, err := conn.ReadFrame()
		if err != nil {
			return
		}
		var ctrl controlMessage
		if err := json.Unmarshal(f.Payload, &ctrl); err != nil {
			log.Warn("agent_ws_invalid_control_message", "agent_id", agentID)
			continue
		}
		switch ctrl.Type {
		case "register":
			s.agentRegistry.SetServices(agentID, ctrl.Services)
			log.Info("agent_ws_registered", "agent_id", agentID, "services", len(ctrl.Services))
		case "relay-ready":
			// Optional acknowledgement that the agent dialed /ws/relay.
			log.Debug("agent_ws_relay_ready", "agent_id", agentID, "relay_id", ctrl.RelayID)
		default:
			// Unknown control messages are ignored.
		}
	}
}

// handleBrowserWS is the browser connection. It requires a valid, unused,
// unexpired WS token and a registered agent+service. On success it issues a
// one-time relay token, sends relay-open over the agent control connection,
// waits (bounded) for the agent's relay dial, then pipes frames opaquely.
func (s *Server) handleBrowserWS(w http.ResponseWriter, r *http.Request) {
	if s.shuttingDown.Load() != 0 {
		http.Error(w, "Session is shutting down", http.StatusServiceUnavailable)
		return
	}
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "token is required", http.StatusUnauthorized)
		return
	}
	if !s.wsTokens.Consume(token) {
		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	agentID := r.URL.Query().Get("agent")
	if agentID == "" || !s.agentRegistry.Has(agentID) {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	}
	service := r.URL.Query().Get("service")
	if service == "" || !s.agentRegistry.HasService(agentID, service) {
		http.Error(w, "Service not found", http.StatusNotFound)
		return
	}

	conn, err := ws.Upgrade(w, r)
	if err != nil {
		log.Error("browser_ws_upgrade_failed", err, "agent_id", agentID, "service", service)
		return
	}
	defer conn.Close()
	log.Info("browser_ws_connected", "agent_id", agentID, "service", service)

	// Issue a one-time relay token and register the relay.
	relayToken, err := s.relayTokens.Issue()
	if err != nil {
		log.Error("relay_token_issue_failed", err)
		return
	}
	controlConn := s.agentRegistry.Get(agentID)
	entry, err := s.relays.create(agentID, service, conn, relayToken, controlConn)
	if err != nil {
		log.Error("relay_create_failed", err)
		return
	}
	defer s.relays.close(entry.id)

	// Start the pipe goroutines immediately. The browser→relay direction
	// reads from the browser connection, so a browser disconnect before the
	// agent dials is detected and tears the relay down (invalidating the
	// one-time relay token).
	startRelayPipes(entry)

	// Send relay-open over the agent control connection.
	openMsg := map[string]interface{}{
		"type":        "relay-open",
		"relay_id":    entry.id,
		"service":     service,
		"relay_token": relayToken,
	}
	if err := s.relays.sendControl(controlConn, openMsg); err != nil {
		log.Warn("relay_open_send_failed", "agent_id", agentID, "relay_id", entry.id)
		return
	}

	// Wait (bounded) for the agent to dial /ws/relay with the one-time
	// token. If it never arrives, the browser gets a clean close.
	select {
	case <-entry.attached:
	case <-entry.done:
		return
	case <-time.After(s.relayOpenTimeout):
		log.Warn("relay_open_timeout", "agent_id", agentID, "relay_id", entry.id)
		return
	}

	// The relay is established; block until it is torn down (browser or
	// agent relay side closed).
	<-entry.done

	// Notify the agent so it can close the corresponding upstream
	// connection. If the control connection is gone (agent control loss),
	// this fails silently — the agent's relay connection close already
	// signals it.
	_ = s.relays.sendControl(controlConn, map[string]interface{}{
		"type":     "relay-close",
		"relay_id": entry.id,
	})
}

// handleRelayWS is the agent relay connection, authenticated by a one-time
// relay token. It attaches to the pending relay and pipes frames opaquely.
func (s *Server) handleRelayWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("relayToken")
	if token == "" {
		http.Error(w, "relayToken is required", http.StatusUnauthorized)
		return
	}
	if !s.relayTokens.Consume(token) {
		http.Error(w, "Invalid or expired relay token", http.StatusUnauthorized)
		return
	}

	conn, err := ws.Upgrade(w, r)
	if err != nil {
		log.Error("relay_ws_upgrade_failed", err)
		return
	}
	defer conn.Close()
	log.Info("relay_ws_connected", "relay_token", token[:8])

	entry, ok := s.relays.attach(token, conn)
	if !ok {
		// The browser disconnected or timed out before the agent dialed;
		// the token is already consumed, so this late dial is rejected.
		log.Warn("relay_attach_failed", "reason", "no pending relay for token")
		return
	}

	// The pipe goroutines were started by the browser handler; block until
	// the relay is torn down.
	<-entry.done
}

// controlMessage is a JSON control message on the agent control connection.
type controlMessage struct {
	Type     string    `json:"type"`
	Services []Service `json:"services"`
	RelayID  string    `json:"relay_id"`
}

// bearerToken extracts the token from an "Authorization: Bearer <token>"
// header, or returns "".
func bearerToken(header string) string {
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

// writeJSON writes a JSON response with the given status.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
