package api

import (
	"sync"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/log"
	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/ws"
)

// Service describes a service registered by an agent.
type Service struct {
	Name     string `json:"name"`
	Upstream string `json:"upstream"`
}

// AgentInfo is the public view of a registered agent.
type AgentInfo struct {
	AgentID      string    `json:"agent_id"`
	Status       string    `json:"status"`
	Services     []string  `json:"services"`
	RegisteredAt time.Time `json:"registered_at"`
}

// agentEntry holds a registered agent's control connection and services.
type agentEntry struct {
	conn         *ws.Conn
	services     []Service
	registeredAt time.Time
	// terminateCh is closed by Disconnect to signal handleAgentWS that it
	// should send close code 4001 and close the connection. This avoids a
	// concurrent-write race: gorilla/websocket does not allow concurrent
	// reads and writes on the same connection. handleAgentWS owns the read
	// loop; the write of the close frame must be done from the same
	// goroutine (or serialised via a mutex) rather than from Disconnect.
	terminateCh chan struct{}
}

// AgentRegistry maintains the set of registered agents. It is multi-agent:
// distinct agent IDs coexist, and a second control connection with the same
// agent ID replaces the first.
type AgentRegistry struct {
	mu      sync.RWMutex
	entries map[string]*agentEntry
	// onEmpty is called (outside the lock, in a goroutine) when the last
	// registered agent unregisters and the registry becomes empty. Only
	// fired after at least one agent has been registered (to avoid firing
	// on startup before any agent connects). May be nil.
	onEmpty  func()
	everFull bool // true once at least one agent has been registered
}

// NewAgentRegistry creates an empty agent registry.
func NewAgentRegistry() *AgentRegistry {
	return &AgentRegistry{
		entries: make(map[string]*agentEntry),
	}
}

// SetOnEmpty registers a callback that is invoked once, in its own goroutine,
// when the registry transitions from non-empty to empty after at least one
// agent has registered. Intended for CE-mode auto-shutdown. Must be called
// before any agents register.
func (r *AgentRegistry) SetOnEmpty(fn func()) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.onEmpty = fn
}

// maybeFireOnEmpty fires onEmpty (in a goroutine) if the registry is now
// empty and has previously been non-empty. Must be called with r.mu held.
// Releases r.mu before dispatching the goroutine.
func (r *AgentRegistry) maybeFireOnEmpty() {
	if r.everFull && len(r.entries) == 0 && r.onEmpty != nil {
		fn := r.onEmpty
		r.onEmpty = nil // fire at most once
		r.mu.Unlock()
		go fn()
		return
	}
	r.mu.Unlock()
}

// Register adds or replaces the control connection for an agent. A second
// connection with the same agent ID closes the previous one (replacement
// semantics). Services are reset until the agent sends a register message.
<<<<<<< Updated upstream
func (r *AgentRegistry) Register(agentID string, conn *websocket.Conn) chan struct{} {
=======
func (r *AgentRegistry) Register(agentID string, conn *ws.Conn) {
>>>>>>> Stashed changes
	r.mu.Lock()
	defer r.mu.Unlock()

	if existing, ok := r.entries[agentID]; ok {
		log.Warn("agent_connection_replaced", map[string]interface{}{
			"agent_id": agentID,
		})
		if existing.conn != nil {
			existing.conn.Close()
		}
	}

	terminateCh := make(chan struct{})
	r.entries[agentID] = &agentEntry{
		conn:         conn,
		services:     nil,
		registeredAt: time.Now(),
		terminateCh:  terminateCh,
	}
	r.everFull = true
	log.Info("agent_connection_registered", map[string]interface{}{
		"agent_id": agentID,
	})
	return terminateCh
}

// Unregister removes an agent's control connection, but only if the given
// connection is the one currently registered (a stale handler whose
// connection was replaced must not remove the new entry).
func (r *AgentRegistry) Unregister(agentID string, conn *ws.Conn) {
	r.mu.Lock()

	entry, ok := r.entries[agentID]
	if !ok {
		r.mu.Unlock()
		return
	}
	if entry.conn != conn {
		log.Info("agent_connection_unregister_skipped_stale", map[string]interface{}{
			"agent_id": agentID,
		})
		r.mu.Unlock()
		return
	}
	if entry.conn != nil {
		entry.conn.Close()
	}
	delete(r.entries, agentID)
	log.Info("agent_connection_unregistered", map[string]interface{}{
		"agent_id": agentID,
	})
	r.maybeFireOnEmpty() // releases r.mu
}

// SetServices records the services registered by an agent and marks it ready.
func (r *AgentRegistry) SetServices(agentID string, services []Service) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.entries[agentID]
	if !ok {
		return false
	}
	entry.services = services
	return true
}

// Get returns the control connection for an agent, or nil.
func (r *AgentRegistry) Get(agentID string) *ws.Conn {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if entry, ok := r.entries[agentID]; ok {
		return entry.conn
	}
	return nil
}

// Has reports whether an agent is registered.
func (r *AgentRegistry) Has(agentID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.entries[agentID]
	return ok
}

// HasService reports whether a registered agent offers the named service.
func (r *AgentRegistry) HasService(agentID, service string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	entry, ok := r.entries[agentID]
	if !ok {
		return false
	}
	for _, s := range entry.services {
		if s.Name == service {
			return true
		}
	}
	return false
}

// List returns the public view of all registered agents.
// Status is "ready" once the agent has sent its register message (at least
// one service is listed); "pending" before that.
func (r *AgentRegistry) List() []AgentInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	infos := make([]AgentInfo, 0, len(r.entries))
	for id, entry := range r.entries {
		services := make([]string, 0, len(entry.services))
		for _, s := range entry.services {
			services = append(services, s.Name)
		}
		status := "pending"
		if len(entry.services) > 0 {
			status = "ready"
		}
		infos = append(infos, AgentInfo{
			AgentID:      id,
			Status:       status,
			Services:     services,
			RegisteredAt: entry.registeredAt,
		})
	}
	return infos
}

// Count returns the number of registered agents.
func (r *AgentRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.entries)
}

// closeCodeAgentTerminated is the WS close code sent to a job-agent control
// connection when the session is deliberately terminated (End Session / DELETE
// /agents/{id}). The job-agent detects this code and shuts down instead of
// reconnecting.
const closeCodeAgentTerminated = 4001

// Disconnect signals the control connection for an agent to send close code
// 4001 and shut down, then removes the agent from the registry. The actual
// write of the close frame is performed by handleAgentWS (which owns the
// connection's read loop) via the terminateCh, avoiding a concurrent-write
// race. Returns true if an entry existed.
func (r *AgentRegistry) Disconnect(agentID string) bool {
	r.mu.Lock()

	entry, ok := r.entries[agentID]
	if !ok {
		r.mu.Unlock()
		return false
	}
	terminateCh := entry.terminateCh
	delete(r.entries, agentID)
	log.Info("agent_disconnected_by_request", map[string]interface{}{
		"agent_id": agentID,
	})
	r.maybeFireOnEmpty() // releases r.mu

	// Signal the handleAgentWS goroutine to send close 4001 and close the
	// connection. Do this after releasing the lock so we don't hold the
	// registry lock while closing.
	if terminateCh != nil {
		close(terminateCh)
	}
	return true
}

// Close closes all control connections and clears the registry.
func (r *AgentRegistry) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()

	for agentID, entry := range r.entries {
		if entry.conn != nil {
			entry.conn.Close()
		}
		log.Info("agent_connection_closed", map[string]interface{}{
			"agent_id": agentID,
		})
	}
	r.entries = make(map[string]*agentEntry)
}
