package tunnel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.ibm.com/JORDANJ/remote-bob-common/log"
)

// Control message types on the agent control connection (JSON text frames).
const (
	controlRegister   = "register"
	controlRelayOpen  = "relay-open"
	controlRelayClose = "relay-close"
)

// serviceRegistration is the register control message payload.
type serviceRegistration struct {
	Name     string `json:"name"`
	Upstream string `json:"upstream"`
}

// registerMessage is the agent → apiserver register control message.
type registerMessage struct {
	Type     string                `json:"type"`
	Services []serviceRegistration `json:"services"`
}

// relayOpenMessage is the apiserver → agent relay-open control message.
type relayOpenMessage struct {
	Type       string `json:"type"`
	RelayID    string `json:"relay_id"`
	Service    string `json:"service"`
	RelayToken string `json:"relay_token"`
}

// relayCloseMessage is the apiserver → agent relay-close control message.
type relayCloseMessage struct {
	Type    string `json:"type"`
	RelayID string `json:"relay_id"`
}

// controlConn wraps the agent control WS connection with a write mutex
// (gorilla/websocket allows only one concurrent writer per connection).
type controlConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *controlConn) writeJSON(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

// relay tracks a single active browser relay: the upstream connection to the
// local service and the agent-side relay connection to the apiserver.
type relay struct {
	id       string
	service  string
	upstream *websocket.Conn
	relayWS  *websocket.Conn
	done     chan struct{}
	closeOnce sync.Once
}

func (r *relay) close() {
	r.closeOnce.Do(func() {
		close(r.done)
		if r.upstream != nil {
			_ = r.upstream.Close()
		}
		if r.relayWS != nil {
			_ = r.relayWS.Close()
		}
	})
}

// controlLoop owns the agent control connection: it dials /ws/agent with the
// run token in the Authorization header, registers the ttyd service, handles
// relay-open/relay-close control messages, and reconnects with backoff on
// control loss (re-registering without restarting tmux/ttyd).
type controlLoop struct {
	cfg      *Config
	adapter  *ttydAdapter
	relaysMu sync.Mutex
	relays   map[string]*relay
	// activeRelays is the count of live relays, used by the idle timer.
	activeRelays int
	// inFlight is the count of relay-open handlers currently establishing a
	// relay (upstream dial in progress). It suppresses the idle timer during
	// relay establishment.
	inFlight int
	// activityCh is notified on relay attach/detach so the idle timer can
	// reset.
	activityCh chan struct{}
	// dialer is the WS dialer used for control and relay dials.
	dialer *websocket.Dialer
}

func newControlLoop(cfg *Config, adapter *ttydAdapter) *controlLoop {
	return &controlLoop{
		cfg:        cfg,
		adapter:    adapter,
		relays:     make(map[string]*relay),
		activityCh: make(chan struct{}, 16),
		dialer: &websocket.Dialer{
			HandshakeTimeout: 10 * time.Second,
		},
	}
}

// run dials the control connection and handles control messages until ctx is
// cancelled. On control loss it reconnects with backoff and re-registers.
// If the server sends WS close code 4001 (deliberate termination), run returns
// errTerminated immediately without reconnecting.
func (cl *controlLoop) run(ctx context.Context) error {
	backoff := cl.cfg.ReconnectDelay
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		err := cl.controlOnce(ctx)
		if ctx.Err() != nil {
			return ctx.Err()
		}
		// If the apiserver sent a deliberate termination close frame, do not
		// reconnect — propagate the sentinel so the caller can shut down.
		if errors.Is(err, errTerminated) {
			return errTerminated
		}
		if err != nil {
			log.Warn("control_connection_lost", map[string]interface{}{
				"error": err.Error(),
			})
		}
		// Reconnect with backoff. A rejected re-dial (expired/invalid run
		// token) is retried with the same backoff; the agent never crashes
		// or spins on a rejected re-dial.
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}
	}
}

// controlOnce establishes a single control connection, registers services,
// and handles control messages until the connection drops.
func (cl *controlLoop) controlOnce(ctx context.Context) error {
	conn, err := cl.dialControl(ctx)
	if err != nil {
		return err
	}
	defer conn.conn.Close()
	// Close the connection when the context is cancelled so the read loop
	// unblocks and the loop can exit cleanly.
	go func() {
		<-ctx.Done()
		_ = conn.conn.Close()
	}()
	log.Info("control_connected", map[string]interface{}{
		"agent_id": cl.cfg.AgentID,
	})

	if err := cl.register(conn); err != nil {
		return err
	}
	log.Info("control_registered", map[string]interface{}{
		"agent_id": cl.cfg.AgentID,
		"service":  "ttyd",
	})

	// Read control messages. A single reader goroutine owns the connection;
	// relay handling runs in its own goroutines.
	for {
		_, msg, err := conn.conn.ReadMessage()
		if err != nil {
			// Deliberate server-initiated termination: return the sentinel so
			// the caller (run) does not reconnect.
			if websocket.IsCloseError(err, closeCodeAgentTerminated) {
				log.Info("control_terminated_by_server", map[string]interface{}{
					"agent_id": cl.cfg.AgentID,
				})
				return errTerminated
			}
			return err
		}
		var header struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(msg, &header); err != nil {
			log.Warn("control_invalid_message", map[string]interface{}{
				"agent_id": cl.cfg.AgentID,
			})
			continue
		}
		switch header.Type {
		case controlRelayOpen:
			var open relayOpenMessage
			if err := json.Unmarshal(msg, &open); err != nil {
				log.Warn("control_relay_open_invalid", map[string]interface{}{
					"agent_id": cl.cfg.AgentID,
				})
				continue
			}
			go cl.handleRelayOpen(ctx, conn, open)
		case controlRelayClose:
			var closeMsg relayCloseMessage
			if err := json.Unmarshal(msg, &closeMsg); err != nil {
				continue
			}
			cl.closeRelay(closeMsg.RelayID)
		default:
			// Unknown control messages are ignored (forward-compatible).
		}
	}
}

// dialControl dials GATEWAY_WSS/ws/agent?agent=<AGENT_ID> with the run token
// in the Authorization: Bearer header (never in the URL).
func (cl *controlLoop) dialControl(ctx context.Context) (*controlConn, error) {
	url := controlURL(cl.cfg.GatewayWSS, cl.cfg.AgentID)
	header := http.Header{}
	header.Set("Authorization", "Bearer "+cl.cfg.RunToken)
	conn, resp, err := cl.dialer.DialContext(ctx, url, header)
	if err != nil {
		if resp != nil {
			return nil, fmt.Errorf("control dial failed (status %d): %w", resp.StatusCode, err)
		}
		return nil, fmt.Errorf("control dial failed: %w", err)
	}
	return &controlConn{conn: conn}, nil
}

// register sends the register control message with the ttyd service.
func (cl *controlLoop) register(conn *controlConn) error {
	return conn.writeJSON(registerMessage{
		Type: controlRegister,
		Services: []serviceRegistration{
			{Name: "ttyd", Upstream: cl.adapter.upstreamURL},
		},
	})
}

// handleRelayOpen opens the upstream to the requested service, dials the
// relay with the one-time token, performs the ttyd handshake, forwards the
// first browser frame, then pipes frames opaquely in both directions.
func (cl *controlLoop) handleRelayOpen(ctx context.Context, control *controlConn, open relayOpenMessage) {
	// Mark the relay as in-flight so the idle timer is suppressed while the
	// upstream/relay are being established.
	cl.relaysMu.Lock()
	cl.inFlight++
	cl.relaysMu.Unlock()
	defer func() {
		cl.relaysMu.Lock()
		cl.inFlight--
		cl.relaysMu.Unlock()
		select {
		case cl.activityCh <- struct{}{}:
		default:
		}
	}()

	if open.Service != "ttyd" {
		log.Warn("relay_open_unknown_service", map[string]interface{}{
			"relay_id": open.RelayID,
			"service":  open.Service,
		})
		return
	}

	// Open the upstream to ttyd (with the 1.7.7 handshake). If ttyd is not
	// reachable (not ready, max-clients exceeded, or dead), fail cleanly and
	// stay registered — the browser gets a clean close from the apiserver.
	upstream, err := cl.adapter.dialUpstream(ctx)
	if err != nil {
		log.Warn("relay_open_upstream_failed", map[string]interface{}{
			"relay_id": open.RelayID,
			"service":  open.Service,
			"error":    err.Error(),
		})
		return
	}

	// Dial the agent relay connection with the one-time token.
	relayConn, _, err := cl.dialer.DialContext(ctx, relayURL(cl.cfg.GatewayWSS, open.RelayToken), nil)
	if err != nil {
		_ = upstream.Close()
		log.Warn("relay_open_relay_dial_failed", map[string]interface{}{
			"relay_id": open.RelayID,
			"error":    err.Error(),
		})
		return
	}

	r := &relay{
		id:       open.RelayID,
		service:  open.Service,
		upstream: upstream,
		relayWS:  relayConn,
		done:     make(chan struct{}),
	}
	cl.trackRelay(r, true)
	defer cl.trackRelay(r, false)
	defer r.close()

	// The first browser frame (a resize frame) is forwarded to ttyd before
	// the opaque pipe starts. Read it from the relay connection.
	_, firstPayload, err := relayConn.ReadMessage()
	if err != nil {
		log.Warn("relay_open_first_frame_failed", map[string]interface{}{
			"relay_id": open.RelayID,
			"error":    err.Error(),
		})
		return
	}
	if err := cl.adapter.forwardFirstResize(upstream, firstPayload); err != nil {
		log.Warn("relay_open_first_frame_forward_failed", map[string]interface{}{
			"relay_id": open.RelayID,
			"error":    err.Error(),
		})
		return
	}

	// Pipe opaquely in both directions. Each direction has exactly one
	// reader on its source connection.
	errCh := make(chan error, 2)
	go pipeFrames(relayConn, upstream, errCh)
	go pipeFrames(upstream, relayConn, errCh)

	select {
	case <-ctx.Done():
		return
	case <-r.done:
		return
	case err := <-errCh:
		if err != nil {
			log.Info("relay_pipe_closed", map[string]interface{}{
				"relay_id": open.RelayID,
				"error":    err.Error(),
			})
		}
		return
	}
}

// trackRelay adds or removes a relay from the active set and notifies the
// idle timer.
func (cl *controlLoop) trackRelay(r *relay, add bool) {
	cl.relaysMu.Lock()
	if add {
		cl.relays[r.id] = r
		cl.activeRelays++
	} else {
		if _, ok := cl.relays[r.id]; ok {
			delete(cl.relays, r.id)
			cl.activeRelays--
		}
	}
	cl.relaysMu.Unlock()
	select {
	case cl.activityCh <- struct{}{}:
	default:
	}
}

// closeRelay closes the upstream for a relay-close control message.
func (cl *controlLoop) closeRelay(relayID string) {
	cl.relaysMu.Lock()
	r, ok := cl.relays[relayID]
	cl.relaysMu.Unlock()
	if ok {
		r.close()
	}
}

// hasActiveRelays reports whether any relay is currently live or being
// established.
func (cl *controlLoop) hasActiveRelays() bool {
	cl.relaysMu.Lock()
	defer cl.relaysMu.Unlock()
	return cl.activeRelays > 0 || cl.inFlight > 0
}

// closeAllRelays closes every active relay (graceful shutdown).
func (cl *controlLoop) closeAllRelays() {
	cl.relaysMu.Lock()
	relays := make([]*relay, 0, len(cl.relays))
	for _, r := range cl.relays {
		relays = append(relays, r)
	}
	cl.relaysMu.Unlock()
	for _, r := range relays {
		r.close()
	}
}

// pipeFrames copies frames from src to dst opaquely, preserving opcode, FIN
// bit, and payload bytes. It reports the first error on errCh.
func pipeFrames(src, dst *websocket.Conn, errCh chan<- error) {
	for {
		msgType, payload, err := src.ReadMessage()
		if err != nil {
			errCh <- err
			return
		}
		if err := dst.WriteMessage(msgType, payload); err != nil {
			errCh <- err
			return
		}
	}
}

// idleTimeout runs the idle watchdog: it exits (via the returned channel)
// after cfg.IdleTimeout with no active relays and no activity. Active relays
// and relay activity suppress the timer.
func (cl *controlLoop) idleTimeout(ctx context.Context) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		timer := time.NewTimer(cl.cfg.IdleTimeout)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-cl.activityCh:
				// Relay activity resets the idle timer.
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				timer.Reset(cl.cfg.IdleTimeout)
			case <-timer.C:
				if cl.hasActiveRelays() {
					// A relay is active; suppress the timeout and re-arm.
					timer.Reset(cl.cfg.IdleTimeout)
					continue
				}
				log.Info("idle_timeout_exit", map[string]interface{}{
					"idle_timeout_ms": cl.cfg.IdleTimeout.Milliseconds(),
				})
				close(done)
				return
			}
		}
	}()
	return done
}

// errControlLoop is a sentinel for control-loop shutdown.
var errControlLoop = errors.New("control loop stopped")

// errTerminated is returned by controlLoop.run when the apiserver sends WS
// close code 4001 (closeCodeAgentTerminated), signalling a deliberate "End
// Session" termination. The job-agent must shut down instead of reconnecting.
var errTerminated = errors.New("agent terminated by server")

// closeCodeAgentTerminated must match the constant in the apiserver's
// agent_registry.go. Using 4001 (application-defined range 4000–4999).
const closeCodeAgentTerminated = 4001
