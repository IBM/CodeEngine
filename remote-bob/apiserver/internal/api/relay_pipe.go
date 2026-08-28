package api

import (
	"encoding/binary"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/log"
	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/ws"
)

// closeCodeAgentGone is the application-level WS close code sent to the
// browser when the agent side of the relay closes. The browser uses this to
// distinguish a deliberate agent exit (show "session ended") from a transient
// network drop (show "reconnecting").
const closeCodeAgentGone = 4000

// startRelayPipes starts the two one-way copy goroutines for a relay: one
// from the browser to the agent relay connection, one from the agent relay
// connection to the browser. Each direction has exactly one reader on its
// source connection, so no frames are consumed by a competing reader.
//
// The browser→relay direction doubles as the browser-disconnect detector:
// while the agent has not yet dialed /ws/relay, a browser close is observed
// by the read loop and tears the relay down (invalidating the one-time relay
// token so a late agent dial is rejected).
func startRelayPipes(e *relayEntry) {
	e.pipesStarted = true
	go browserToRelay(e)
	go relayToBrowser(e)
}

// relayConn returns the agent-side relay connection, or nil if it has not
// been attached yet.
func (e *relayEntry) relayConn() *ws.Conn {
	e.relayMu.Lock()
	defer e.relayMu.Unlock()
	return e.relay
}

// browserToRelay copies frames from the browser to the agent relay
// connection. It starts reading immediately so a browser disconnect before
// the agent dials is detected and tears the relay down. Frames read before
// the relay attaches are held until the relay is available.
func browserToRelay(e *relayEntry) {
	for {
		f, err := e.browser.ReadFrame()
		if err != nil {
			// Browser closed (before or during the relay).
			teardownRelay(e, false)
			return
		}
		// Wait for the agent's relay connection if it has not dialed yet.
		select {
		case <-e.attached:
		case <-e.done:
			return
		}
		relay := e.relayConn()
		if relay == nil {
			return
		}
		if err := relay.WriteFrame(f.MessageType, f.Payload); err != nil {
			teardownRelay(e, false)
			return
		}
	}
}

// relayToBrowser copies frames from the agent relay connection to the
// browser. It waits for the agent's relay dial before reading. When the
// agent side closes (upstream failure, agent control loss, agent shutdown),
// a close frame with closeCodeAgentGone is sent to the browser so it can
// distinguish a deliberate agent exit from a transient drop.
func relayToBrowser(e *relayEntry) {
	select {
	case <-e.attached:
	case <-e.done:
		return
	}
	relay := e.relayConn()
	if relay == nil {
		return
	}
	for {
		f, err := relay.ReadFrame()
		if err != nil {
			// Agent side closed — send close code 4000 to the browser before
			// tearing down so it can show "session ended" rather than an error.
			agentGoneFrame := buildCloseFrame(closeCodeAgentGone, "agent disconnected")
			_ = e.browser.WriteFrame(ws.MsgClose, agentGoneFrame)
			teardownRelay(e, true)
			return
		}
		if err := e.browser.WriteFrame(f.MessageType, f.Payload); err != nil {
			teardownRelay(e, false)
			return
		}
	}
}

// buildCloseFrame encodes a WebSocket close frame payload: 2-byte big-endian
// code followed by the UTF-8 reason string (RFC 6455 §5.5.1).
func buildCloseFrame(code int, reason string) []byte {
	payload := make([]byte, 2+len(reason))
	binary.BigEndian.PutUint16(payload[:2], uint16(code))
	copy(payload[2:], reason)
	return payload
}

// teardownRelay closes the relay's done channel and both connections. It is
// idempotent and safe to call from any goroutine. agentClosed indicates the
// relay is being torn down because the agent side disconnected (the browser
// close frame was already sent with closeCodeAgentGone by relayToBrowser).
func teardownRelay(e *relayEntry, agentClosed bool) {
	e.closeOnce.Do(func() {
		close(e.done)
		if e.browser != nil {
			e.browser.Close()
		}
		if relay := e.relayConn(); relay != nil {
			relay.Close()
		}
		log.Info("relay_closed", "relay_id", e.id, "agent_id", e.agentID, "service", e.service, "agent_closed", agentClosed)
	})
}
