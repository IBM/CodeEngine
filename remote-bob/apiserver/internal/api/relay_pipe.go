package api

import (
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
<<<<<<< Updated upstream
		if err := relay.SetWriteDeadline(time.Now().Add(relayWriteWait)); err != nil {
			teardownRelay(e, false)
			return
		}
		if err := relay.WriteMessage(msgType, payload); err != nil {
			teardownRelay(e, false)
=======
		if err := relay.WriteFrame(f.MessageType, f.Payload); err != nil {
			teardownRelay(e)
>>>>>>> Stashed changes
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
			// Agent side closed — notify the browser with the agent-gone code
			// before tearing down so the browser can show "session ended".
			agentGoneMsg := websocket.FormatCloseMessage(closeCodeAgentGone, "agent disconnected")
			_ = e.browser.SetWriteDeadline(time.Now().Add(relayWriteWait))
			_ = e.browser.WriteMessage(websocket.CloseMessage, agentGoneMsg)
			teardownRelay(e, true)
			return
		}
<<<<<<< Updated upstream
		if err := e.browser.SetWriteDeadline(time.Now().Add(relayWriteWait)); err != nil {
			teardownRelay(e, false)
			return
		}
		if err := e.browser.WriteMessage(msgType, payload); err != nil {
			teardownRelay(e, false)
=======
		if err := e.browser.WriteFrame(f.MessageType, f.Payload); err != nil {
			teardownRelay(e)
>>>>>>> Stashed changes
			return
		}
	}
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
		log.Info("relay_closed", map[string]interface{}{
			"relay_id":     e.id,
			"agent_id":     e.agentID,
			"service":      e.service,
			"agent_closed": agentClosed,
		})
	})
}
