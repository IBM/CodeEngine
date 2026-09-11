package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/CodeEngine/remote-bob-job-agent/internal/log"
	"github.com/CodeEngine/remote-bob-job-agent/internal/ws"
)

// ttyd 1.7.7 binary protocol opcodes (ASCII prefix bytes on binary frames).
const (
	ttydOpcodeOutput = '0' // 0x30 — terminal output (ttyd → client)
	ttydOpcodeInput  = '0' // 0x30 — keyboard input (client → ttyd)
	ttydOpcodeResize = '1' // 0x31 — resize JSON {columns,rows} (client → ttyd)
)

// ttydHandshake is the ttyd 1.7.7 binary JSON handshake frame sent on
// upstream connect: {"AuthToken":"","columns":N,"rows":N}.
type ttydHandshake struct {
	AuthToken string `json:"AuthToken"`
	Columns   int    `json:"columns"`
	Rows      int    `json:"rows"`
}

// ttydResize is the JSON payload of a ttyd resize frame (opcode 0x31).
type ttydResize struct {
	Columns int `json:"columns"`
	Rows    int `json:"rows"`
}

// ttydAdapter is the service-specific upstream edge for the ttyd service.
// It owns the ttyd 1.7.7 handshake and the first-frame resize forwarding;
// after that the relay pipes frames opaquely.
type ttydAdapter struct {
	upstreamURL string
	// handshakeCols/Rows are the initial terminal size sent in the handshake.
	handshakeCols int
	handshakeRows int
}

// newTTYDAdapter builds an adapter for the given upstream URL.
func newTTYDAdapter(upstreamURL string) *ttydAdapter {
	return &ttydAdapter{
		upstreamURL:   upstreamURL,
		handshakeCols: 80,
		handshakeRows: 24,
	}
}

// dialUpstream opens the upstream WS to ttyd with the tty subprotocol,
// performs the 1.7.7 binary JSON handshake, and returns the connection.
func (a *ttydAdapter) dialUpstream(ctx context.Context) (*ws.Conn, error) {
	opts := &ws.DialOptions{
		Subprotocols: []string{"tty"},
	}
	conn, _, err := ws.DialContext(ctx, a.upstreamURL, opts)
	if err != nil {
		return nil, fmt.Errorf("ttyd upstream dial failed: %w", err)
	}
	handshake, err := json.Marshal(ttydHandshake{
		AuthToken: "",
		Columns:   a.handshakeCols,
		Rows:      a.handshakeRows,
	})
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("ttyd handshake marshal failed: %w", err)
	}
	if err := conn.WriteMessage(ws.MsgBinary, handshake); err != nil {
		conn.Close()
		return nil, fmt.Errorf("ttyd handshake send failed: %w", err)
	}
	log.Info("ttyd_upstream_connected", map[string]interface{}{
		"upstream": a.upstreamURL,
		"columns":  a.handshakeCols,
		"rows":     a.handshakeRows,
	})
	return conn, nil
}

// forwardFirstResize forwards the first browser frame to ttyd before the
// opaque pipe starts. The browser's first frame is a resize frame (opcode
// 0x31 + JSON {columns,rows}); forwarding it makes the terminal adopt the
// browser's initial size. Returns the frame so the caller can decide whether
// to also forward it through the pipe (it is consumed here and must not be
// re-sent).
func (a *ttydAdapter) forwardFirstResize(upstream *ws.Conn, firstFrame []byte) error {
	if len(firstFrame) == 0 {
		return nil
	}
	// The browser speaks the ttyd binary protocol directly, so its first
	// frame is already a valid ttyd frame. Forward it unchanged.
	if err := upstream.WriteMessage(ws.MsgBinary, firstFrame); err != nil {
		return fmt.Errorf("ttyd first-frame forward failed: %w", err)
	}
	log.Info("ttyd_first_frame_forwarded", map[string]interface{}{
		"length": len(firstFrame),
	})
	return nil
}

// waitForTTYD polls the ttyd upstream until it accepts a connection or the
// timeout elapses. Used at startup so the control dial only happens after
// ttyd is reachable (startup order tmux → ttyd → control dial).
func waitForTTYD(ctx context.Context, upstreamURL string, timeout time.Duration) error {
	opts := &ws.DialOptions{
		Subprotocols: []string{"tty"},
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, _, err := ws.DialContext(ctx, upstreamURL, opts)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(1 * time.Second):
		}
	}
	return fmt.Errorf("ttyd did not become ready within %s", timeout)
}
