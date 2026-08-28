package api

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/ws"
)

// relayWriteWait is the per-write deadline applied when forwarding frames
// between the browser and the agent relay, and when sending control messages
// on an agent control connection. A peer that cannot accept a frame within
// this window is treated as dead and the relay is torn down, which bounds
// buffering instead of growing memory without limit (backpressure).
const relayWriteWait = 30 * time.Second

// relayEntry tracks a single browser↔agent relay. Every browser connection
// gets its own relay with a distinct relay_id and a one-time relay token.
type relayEntry struct {
	id          string
	agentID     string
	service     string
	token       string
	controlConn *ws.Conn // control connection the relay-open was sent on
	browser     *ws.Conn
	relayMu     sync.Mutex
	relay       *ws.Conn // agent-side relay connection
	attached    chan struct{} // closed when the agent dials /ws/relay
	done        chan struct{} // closed when the relay is torn down
	closeOnce   sync.Once
}

// relayManager tracks all active relays, keyed by relay_id and by relay
// token (for the agent's /ws/relay dial). It also serializes control-message
// writes per control connection to ensure only one concurrent writer per conn.
type relayManager struct {
	mu          sync.Mutex
	relays      map[string]*relayEntry // relay_id -> entry
	tokens      map[string]string      // relay token -> relay_id
	connMu      map[*ws.Conn]*sync.Mutex
	revokeToken func(string) // invalidates a relay token on teardown
}

func newRelayManager(revokeToken func(string)) *relayManager {
	return &relayManager{
		relays:      make(map[string]*relayEntry),
		tokens:      make(map[string]string),
		connMu:      make(map[*ws.Conn]*sync.Mutex),
		revokeToken: revokeToken,
	}
}

// create registers a new relay for a browser connection and returns the
// entry. The relay token is issued by the caller.
func (m *relayManager) create(agentID, service string, browser *ws.Conn, token string, controlConn *ws.Conn) (*relayEntry, error) {
	id, err := randomToken()
	if err != nil {
		return nil, err
	}
	e := &relayEntry{
		id:          id,
		agentID:     agentID,
		service:     service,
		token:       token,
		controlConn: controlConn,
		browser:     browser,
		attached:    make(chan struct{}),
		done:        make(chan struct{}),
	}
	m.mu.Lock()
	m.relays[id] = e
	m.tokens[token] = id
	m.mu.Unlock()
	return e, nil
}

// attach binds the agent's relay connection to the relay identified by the
// one-time token. It returns false if the relay no longer exists (the
// browser disconnected or timed out before the agent dialed).
func (m *relayManager) attach(token string, conn *ws.Conn) (*relayEntry, bool) {
	m.mu.Lock()
	id, ok := m.tokens[token]
	if !ok {
		m.mu.Unlock()
		return nil, false
	}
	e, ok := m.relays[id]
	if !ok {
		m.mu.Unlock()
		return nil, false
	}
	e.relayMu.Lock()
	e.relay = conn
	e.relayMu.Unlock()
	m.mu.Unlock()
	// If the relay was already torn down (browser disconnected or timed out
	// before the dial), close the agent's relay connection immediately so
	// no orphan connection remains.
	select {
	case <-e.done:
		conn.Close()
		return nil, false
	default:
	}
	close(e.attached)
	return e, true
}

// hasToken reports whether a relay entry exists for the given token.
func (m *relayManager) hasToken(token string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.tokens[token]
	return ok
}

// sendControl writes a JSON control message on an agent control connection,
// serialized per connection. It returns an error if the connection is nil
// or the write fails (e.g. the connection was replaced and closed).
func (m *relayManager) sendControl(conn *ws.Conn, v interface{}) error {
	if conn == nil {
		return errors.New("nil control connection")
	}
	m.mu.Lock()
	mu, ok := m.connMu[conn]
	if !ok {
		mu = &sync.Mutex{}
		m.connMu[conn] = mu
	}
	m.mu.Unlock()
	mu.Lock()
	defer mu.Unlock()
	payload, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return conn.WriteFrame(ws.MsgText, payload)
}

// sendRaw writes a raw WebSocket frame on an agent control connection,
// serialized per connection via the same mutex as sendControl. Used to send
// the WS close frame (code 4001) on deliberate termination.
func (m *relayManager) sendRaw(conn *websocket.Conn, msgType int, data []byte) error {
	if conn == nil {
		return errors.New("nil control connection")
	}
	m.mu.Lock()
	mu, ok := m.connMu[conn]
	if !ok {
		mu = &sync.Mutex{}
		m.connMu[conn] = mu
	}
	m.mu.Unlock()
	mu.Lock()
	defer mu.Unlock()
	if err := conn.SetWriteDeadline(time.Now().Add(relayWriteWait)); err != nil {
		return err
	}
	return conn.WriteMessage(msgType, data)
}

// close tears down a relay by id. It is idempotent.
func (m *relayManager) close(relayID string) {
	m.mu.Lock()
	e, ok := m.relays[relayID]
	if ok {
		delete(m.relays, relayID)
		delete(m.tokens, e.token)
	}
	m.mu.Unlock()
	if !ok {
		return
	}
	m.teardown(e)
}

// closeAgent tears down every relay opened on the given control connection
// and releases the per-connection write mutex. Called when an agent's
// control connection drops or is replaced.
func (m *relayManager) closeAgent(agentID string, controlConn *ws.Conn) {
	m.mu.Lock()
	var entries []*relayEntry
	for id, e := range m.relays {
		if e.agentID == agentID && e.controlConn == controlConn {
			entries = append(entries, e)
			delete(m.relays, id)
			delete(m.tokens, e.token)
		}
	}
	delete(m.connMu, controlConn)
	m.mu.Unlock()
	for _, e := range entries {
		m.teardown(e)
	}
}

// closeAll tears down every relay (server shutdown).
func (m *relayManager) closeAll() {
	m.mu.Lock()
	entries := make([]*relayEntry, 0, len(m.relays))
	for id, e := range m.relays {
		entries = append(entries, e)
		delete(m.relays, id)
		delete(m.tokens, e.token)
	}
	m.mu.Unlock()
	for _, e := range entries {
		m.teardown(e)
	}
}

// count returns the number of active relays (used by tests to assert no
// leaks).
func (m *relayManager) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.relays)
}

func (m *relayManager) teardown(e *relayEntry) {
	// Revoke the one-time relay token. If the agent already dialed, the
	// token was consumed and this is a no-op; if the browser disconnected
	// before the dial, a late agent dial is now rejected.
	if m.revokeToken != nil {
		m.revokeToken(e.token)
	}
	// Close only the relay (agent) side. relayToBrowser will observe the
	// read error and send the WS 4000 close frame to the browser before
	// calling teardownRelay itself. Closing the browser here would race
	// with that write and cause the browser to receive 1006 instead.
	e.relayMu.Lock()
	if e.relay != nil {
		e.relay.Close()
	}
	e.relayMu.Unlock()
	// If the relay connection was never established (agent never dialled
	// /ws/relay), the entry is still waiting in relayToBrowser on
	// e.attached. Close done so it unblocks and falls through to the
	// no-relay return path, then call teardownRelay to close the browser.
	select {
	case <-e.attached:
		// relay was attached — relayToBrowser will send 4000 and clean up.
	default:
		// relay was never attached — no relayToBrowser read loop running yet;
		// fall back to direct teardown.
		teardownRelay(e, false)
	}
}
