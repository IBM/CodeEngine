// Package ws implements a minimal WebSocket client and server using only the
// Go standard library (net/http, bufio, crypto/sha1, encoding/base64, etc.).
//
// RFC 6455 compliance notes:
//   - Supports text (0x1) and binary (0x2) data frames.
//   - Supports ping (0x9) / pong (0xA) control frames.
//   - Close (0x8) frame is sent on graceful shutdown.
//   - Client frames are masked; server frames are unmasked (per spec).
//   - Fragmented frames are NOT supported — ttyd never sends them.
package ws

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"crypto/sha1" //nolint:gosec — required by RFC 6455
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Frame message types (RFC 6455 §11.8).
const (
	MsgText   = 1
	MsgBinary = 2
	MsgClose  = 8
	MsgPing   = 9
	MsgPong   = 10
)

// Frame is a single decoded WebSocket frame.
type Frame struct {
	MessageType int
	Payload     []byte
}

// Conn is a WebSocket connection backed by a raw net.Conn.
//
// Concurrency model:
//   - ReadFrame must be called from a single goroutine only (bufio.Reader is
//     not goroutine-safe). Control-frame responses (pong) are sent via writeMu.
//   - WriteFrame / WriteFrameMasked are goroutine-safe; they hold writeMu.
//   - Close is safe to call from any goroutine and is idempotent.
//   - StartPing launches a background goroutine that sends a Ping frame every
//     interval. Call it after upgrading/dialling to keep the connection alive
//     through proxies that close idle WebSocket connections (e.g. Code Engine's
//     HTTP reverse proxy which times out at ~10 minutes).
type Conn struct {
	conn    net.Conn
	rw      *bufio.ReadWriter
	writeMu sync.Mutex  // serialises all writes (WriteFrame, WriteFrameMasked, Close)
	once    sync.Once
	doneCh  chan struct{}
}

// Close sends a Close frame and closes the underlying connection.
func (c *Conn) Close() error {
	// Best-effort close frame under the write mutex.
	c.writeMu.Lock()
	_ = c.writeFrameLocked(MsgClose, nil, false)
	c.writeMu.Unlock()

	err := c.conn.Close()
	c.once.Do(func() { close(c.doneCh) })
	return err
}

// Done returns a channel that is closed when Close is called or the connection dies.
// Use this to park a goroutine without reading from the connection.
func (c *Conn) Done() <-chan struct{} {
	return c.doneCh
}

// StartPing launches a background goroutine that sends a WebSocket Ping frame
// every interval. The goroutine stops automatically when the connection is
// closed (Done fires). Ping frames keep the underlying TCP connection alive
// through load-balancers and reverse proxies that drop idle connections.
//
// Call this once after Upgrade or Dial returns. The interval should be well
// below the proxy idle-timeout — 30 s is a safe choice for Code Engine (10 min
// proxy timeout).
func (c *Conn) StartPing(interval time.Duration) {
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-c.doneCh:
				return
			case <-t.C:
				c.writeMu.Lock()
				err := c.writeFrameLocked(MsgPing, nil, false)
				c.writeMu.Unlock()
				if err != nil {
					return
				}
			}
		}
	}()
}

// ReadFrame reads the next complete data frame from the connection.
// Must be called from a single goroutine only.
// Control frames (ping/pong/close) are handled transparently:
//   - Ping → send Pong and loop.
//   - Close → return io.EOF.
//   - Pong → discard and loop.
func (c *Conn) ReadFrame() (Frame, error) {
	for {
		msgType, payload, err := c.readRawFrame()
		if err != nil {
			c.once.Do(func() { close(c.doneCh) })
			return Frame{}, err
		}
		switch msgType {
		case MsgPing:
			// Pong must go through the write mutex so it does not interleave
			// with concurrent WriteFrame calls from other goroutines.
			c.writeMu.Lock()
			_ = c.writeFrameLocked(MsgPong, payload, false)
			c.writeMu.Unlock()
		case MsgClose:
			c.writeMu.Lock()
			_ = c.writeFrameLocked(MsgClose, nil, false)
			c.writeMu.Unlock()
			c.once.Do(func() { close(c.doneCh) })
			return Frame{}, io.EOF
		case MsgPong:
			// discard
		default:
			return Frame{MessageType: msgType, Payload: payload}, nil
		}
	}
}

// WriteFrame sends an unmasked WebSocket frame (server → client).
// Safe to call concurrently from multiple goroutines.
func (c *Conn) WriteFrame(msgType int, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.writeFrameLocked(msgType, payload, false)
}

// WriteFrameMasked sends a masked frame (client → server, required by RFC 6455).
// Safe to call concurrently from multiple goroutines.
func (c *Conn) WriteFrameMasked(msgType int, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.writeFrameLocked(msgType, payload, true)
}

// ---------------------------------------------------------------------------
// RFC 6455 framing
// ---------------------------------------------------------------------------

func (c *Conn) readRawFrame() (msgType int, payload []byte, err error) {
	// Byte 0: FIN bit + opcode.
	b0, err := c.rw.ReadByte()
	if err != nil {
		return 0, nil, err
	}
	// FIN bit must be set for non-fragmented frames; we don't support fragmentation.
	opcode := int(b0 & 0x0F)

	// Byte 1: MASK bit + payload length.
	b1, err := c.rw.ReadByte()
	if err != nil {
		return 0, nil, err
	}
	masked := b1&0x80 != 0
	length := int64(b1 & 0x7F)

	switch length {
	case 126:
		var ext uint16
		if err = binary.Read(c.rw, binary.BigEndian, &ext); err != nil {
			return 0, nil, err
		}
		length = int64(ext)
	case 127:
		var ext uint64
		if err = binary.Read(c.rw, binary.BigEndian, &ext); err != nil {
			return 0, nil, err
		}
		length = int64(ext)
	}

	var maskKey [4]byte
	if masked {
		if _, err = io.ReadFull(c.rw, maskKey[:]); err != nil {
			return 0, nil, err
		}
	}

	payload = make([]byte, length)
	if _, err = io.ReadFull(c.rw, payload); err != nil {
		return 0, nil, err
	}
	if masked {
		for i := range payload {
			payload[i] ^= maskKey[i%4]
		}
	}
	return opcode, payload, nil
}

// writeFrameLocked writes a frame to the connection.
// Caller MUST hold writeMu.
func (c *Conn) writeFrameLocked(msgType int, payload []byte, masked bool) error {
	length := len(payload)

	var header []byte
	// Byte 0: FIN=1 + opcode.
	header = append(header, byte(0x80|msgType))

	maskBit := byte(0)
	if masked {
		maskBit = 0x80
	}

	switch {
	case length <= 125:
		header = append(header, maskBit|byte(length))
	case length <= 65535:
		header = append(header, maskBit|126)
		header = append(header, byte(length>>8), byte(length))
	default:
		header = append(header, maskBit|127)
		var ext [8]byte
		binary.BigEndian.PutUint64(ext[:], uint64(length))
		header = append(header, ext[:]...)
	}

	var maskKey [4]byte
	if masked {
		if _, err := rand.Read(maskKey[:]); err != nil {
			return err
		}
		header = append(header, maskKey[:]...)
	}

	frame := make([]byte, 0, len(header)+length)
	frame = append(frame, header...)

	if masked {
		maskedPayload := make([]byte, length)
		for i, b := range payload {
			maskedPayload[i] = b ^ maskKey[i%4]
		}
		frame = append(frame, maskedPayload...)
	} else {
		frame = append(frame, payload...)
	}

	_, err := c.rw.Write(frame)
	if err != nil {
		return err
	}
	return c.rw.Flush()
}

// ---------------------------------------------------------------------------
// Server upgrade (HTTP → WebSocket)
// ---------------------------------------------------------------------------

const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

// Upgrade performs the server-side WebSocket handshake.
// It accepts any origin and echoes back the "tty" subprotocol when requested.
func Upgrade(w http.ResponseWriter, r *http.Request) (*Conn, error) {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		http.Error(w, "not a websocket upgrade", http.StatusBadRequest)
		return nil, fmt.Errorf("not a websocket upgrade")
	}

	key := r.Header.Get("Sec-Websocket-Key")
	if key == "" {
		http.Error(w, "missing Sec-Websocket-Key", http.StatusBadRequest)
		return nil, fmt.Errorf("missing Sec-Websocket-Key")
	}

	// Compute accept token (RFC 6455 §4.2.2 step 5.4).
	h := sha1.New() //nolint:gosec
	h.Write([]byte(key + wsGUID))
	accept := base64.StdEncoding.EncodeToString(h.Sum(nil))

	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "server does not support hijacking", http.StatusInternalServerError)
		return nil, fmt.Errorf("hijacking not supported")
	}
	conn, brw, err := hj.Hijack()
	if err != nil {
		return nil, fmt.Errorf("hijack: %w", err)
	}

	// Drain any bytes already buffered by the HTTP server before we switch to
	// our own reader. This avoids the "invalid Body.Read call after hijacked"
	// panic that occurs when the hijacked bufio.Reader still references the
	// HTTP server's internal connReader.
	var preamble []byte
	if brw.Reader.Buffered() > 0 {
		preamble = make([]byte, brw.Reader.Buffered())
		_, _ = io.ReadFull(brw.Reader, preamble)
	}

	// Build a fresh bufio.ReadWriter directly on the net.Conn so we have no
	// references left to the HTTP server's internal connReader.
	br := bufio.NewReaderSize(conn, 4096)
	bw := bufio.NewWriterSize(conn, 4096)
	if len(preamble) > 0 {
		br = bufio.NewReaderSize(io.MultiReader(bytes.NewReader(preamble), conn), 4096)
	}
	rw := bufio.NewReadWriter(br, bw)

	// Build and flush the 101 response by hand (we own the conn now).
	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-Websocket-Accept: " + accept + "\r\n"

	// Echo the "tty" subprotocol if the client requested it.
	if proto := r.Header.Get("Sec-Websocket-Protocol"); strings.Contains(proto, "tty") {
		resp += "Sec-Websocket-Protocol: tty\r\n"
	}
	resp += "\r\n"

	if _, err := rw.WriteString(resp); err != nil {
		conn.Close()
		return nil, fmt.Errorf("write handshake: %w", err)
	}
	if err := rw.Flush(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("flush handshake: %w", err)
	}

	return &Conn{conn: conn, rw: rw, doneCh: make(chan struct{})}, nil
}

// ---------------------------------------------------------------------------
// Client dial (WebSocket client handshake)
// ---------------------------------------------------------------------------

// DialHeader is a set of additional HTTP headers to send with the WebSocket upgrade request.
type DialHeader map[string]string

// DialResult is returned by DialFull and carries both the connection and the
// HTTP response for callers that need to inspect the status code on failure.
type DialResult struct {
	Conn     *Conn
	Response *http.Response
}

// Dial opens a WebSocket connection to rawURL. It uses net.Dial directly so
// we retain access to the raw net.Conn after the HTTP 101 upgrade —
// http.Transport does not expose the underlying connection after switching
// protocols. Additional HTTP headers (e.g. Authorization) can be passed via
// extraHeaders.
func Dial(rawURL string, extraHeaders ...DialHeader) (*Conn, error) {
	res, err := dialFull(rawURL, extraHeaders...)
	if err != nil {
		return nil, err
	}
	return res.Conn, nil
}

// DialFull is like Dial but also returns the HTTP response so callers can
// inspect the status code when the upgrade is rejected.
func DialFull(rawURL string, extraHeaders ...DialHeader) (DialResult, error) {
	return dialFull(rawURL, extraHeaders...)
}

func dialFull(rawURL string, extraHeaders ...DialHeader) (DialResult, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return DialResult{}, fmt.Errorf("dial: parse url %q: %w", rawURL, err)
	}

	// Determine network address and whether TLS is needed.
	host := u.Host
	switch u.Scheme {
	case "ws":
		if !strings.Contains(host, ":") {
			host += ":80"
		}
	case "wss":
		if !strings.Contains(host, ":") {
			host += ":443"
		}
	default:
		return DialResult{}, fmt.Errorf("dial: unsupported scheme %q", u.Scheme)
	}

	// Dial raw TCP (wss/TLS not needed for local Docker compose).
	netConn, err := net.DialTimeout("tcp", host, 10*time.Second)
	if err != nil {
		return DialResult{}, fmt.Errorf("dial tcp %s: %w", host, err)
	}

	// Generate random nonce.
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		netConn.Close()
		return DialResult{}, err
	}
	key := base64.StdEncoding.EncodeToString(nonce)

	// Send the HTTP/1.1 Upgrade request.
	requestPath := u.RequestURI()
	if requestPath == "" {
		requestPath = "/"
	}
	reqLine := fmt.Sprintf(
		"GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"+
			"Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: tty\r\n",
		requestPath, u.Host, key,
	)
	for _, hdr := range extraHeaders {
		for k, v := range hdr {
			reqLine += k + ": " + v + "\r\n"
		}
	}
	reqLine += "\r\n"
	if _, err := netConn.Write([]byte(reqLine)); err != nil {
		netConn.Close()
		return DialResult{}, fmt.Errorf("dial write request: %w", err)
	}

	// Read and validate the 101 response.
	br := bufio.NewReaderSize(netConn, 4096)
	resp, err := http.ReadResponse(br, nil)
	if err != nil {
		netConn.Close()
		return DialResult{}, fmt.Errorf("dial read response: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		netConn.Close()
		return DialResult{Response: resp}, fmt.Errorf("dial: unexpected status %d (want 101)", resp.StatusCode)
	}

	// Verify the accept token.
	h := sha1.New() //nolint:gosec
	h.Write([]byte(key + wsGUID))
	expected := base64.StdEncoding.EncodeToString(h.Sum(nil))
	if got := resp.Header.Get("Sec-Websocket-Accept"); got != expected {
		netConn.Close()
		return DialResult{Response: resp}, fmt.Errorf("dial: invalid Sec-Websocket-Accept: got %q want %q", got, expected)
	}

	bw := bufio.NewWriterSize(netConn, 4096)
	conn := &Conn{
		conn:   netConn,
		rw:     bufio.NewReadWriter(br, bw),
		doneCh: make(chan struct{}),
	}
	return DialResult{Conn: conn, Response: resp}, nil
}
