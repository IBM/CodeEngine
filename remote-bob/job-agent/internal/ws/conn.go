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
	"context"
	"crypto/rand"
	"crypto/sha1" //nolint:gosec — required by RFC 6455
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
)

// Frame message types (RFC 6455 §11.8).
const (
	MsgText   = 1
	MsgBinary = 2
	MsgClose  = 8
	MsgPing   = 9
	MsgPong   = 10
)

// Conn is a WebSocket connection backed by a raw net.Conn.
//
// Concurrency model:
//   - ReadFrame must be called from a single goroutine only (bufio.Reader is
//     not goroutine-safe). Control-frame responses (pong) are sent via writeMu.
//   - WriteFrame / WriteFrameMasked / WriteJSON are goroutine-safe.
//   - Close is safe to call from any goroutine and is idempotent.
type Conn struct {
	conn      net.Conn
	rw        *bufio.ReadWriter
	writeMu   sync.Mutex // serialises all writes
	once      sync.Once
	doneCh    chan struct{}
	closeCode int // populated on a close frame from the peer
}

// CloseCode returns the WebSocket close code from the peer's close frame,
// or 0 if no close frame has been received.
func (c *Conn) CloseCode() int {
	return c.closeCode
}

// Close sends a Close frame and closes the underlying connection.
func (c *Conn) Close() error {
	c.writeMu.Lock()
	_ = c.writeFrameLocked(MsgClose, nil, false)
	c.writeMu.Unlock()

	err := c.conn.Close()
	c.once.Do(func() { close(c.doneCh) })
	return err
}

// Done returns a channel that is closed when Close is called or the connection dies.
func (c *Conn) Done() <-chan struct{} {
	return c.doneCh
}

// ReadFrame reads the next complete data frame from the connection.
// Must be called from a single goroutine only.
// Control frames (ping/pong/close) are handled transparently:
//   - Ping → send Pong and loop.
//   - Close → record close code, return io.EOF.
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
			c.writeMu.Lock()
			_ = c.writeFrameLocked(MsgPong, payload, false)
			c.writeMu.Unlock()
		case MsgClose:
			// Extract the 2-byte close code if present.
			if len(payload) >= 2 {
				c.closeCode = int(payload[0])<<8 | int(payload[1])
			}
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

// Frame is a single decoded WebSocket frame.
type Frame struct {
	MessageType int
	Payload     []byte
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

// WriteJSON marshals v as JSON and sends it as a masked text frame.
// Safe to call concurrently from multiple goroutines.
func (c *Conn) WriteJSON(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.WriteFrameMasked(MsgText, data)
}

// ReadMessage reads the next data frame and returns its type and payload.
// This is a convenience wrapper matching the gorilla/websocket API.
// Must be called from a single goroutine only.
func (c *Conn) ReadMessage() (msgType int, payload []byte, err error) {
	f, err := c.ReadFrame()
	return f.MessageType, f.Payload, err
}

// WriteMessage sends a frame with the given type and payload.
// The frame is masked (client→server semantics).
// Safe to call concurrently from multiple goroutines.
func (c *Conn) WriteMessage(msgType int, payload []byte) error {
	return c.WriteFrameMasked(msgType, payload)
}

// IsCloseError reports whether err signals a WebSocket close with one of the
// given codes. err must be io.EOF (the value ReadFrame returns on close).
func IsCloseError(conn *Conn, err error, codes ...int) bool {
	if err != io.EOF {
		return false
	}
	code := conn.CloseCode()
	for _, c := range codes {
		if code == c {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// RFC 6455 framing
// ---------------------------------------------------------------------------

func (c *Conn) readRawFrame() (msgType int, payload []byte, err error) {
	b0, err := c.rw.ReadByte()
	if err != nil {
		return 0, nil, err
	}
	opcode := int(b0 & 0x0F)

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

func (c *Conn) writeFrameLocked(msgType int, payload []byte, masked bool) error {
	length := len(payload)

	var header []byte
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

	var preamble []byte
	if brw.Reader.Buffered() > 0 {
		preamble = make([]byte, brw.Reader.Buffered())
		_, _ = io.ReadFull(brw.Reader, preamble)
	}

	br := bufio.NewReaderSize(conn, 4096)
	bw := bufio.NewWriterSize(conn, 4096)
	if len(preamble) > 0 {
		br = bufio.NewReaderSize(io.MultiReader(bytes.NewReader(preamble), conn), 4096)
	}
	rw := bufio.NewReadWriter(br, bw)

	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-Websocket-Accept: " + accept + "\r\n"

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

// DialOptions configures a WebSocket dial.
type DialOptions struct {
	// ExtraHeaders are additional HTTP headers sent with the upgrade request.
	ExtraHeaders map[string]string
	// Subprotocols is the list of subprotocols to advertise (e.g. ["tty"]).
	Subprotocols []string
	// TLSConfig overrides TLS settings for wss:// connections.
	TLSConfig *tls.Config
}

// DialContext opens a WebSocket connection to rawURL, honouring ctx for
// cancellation. For wss:// the connection is wrapped in TLS.
func DialContext(ctx context.Context, rawURL string, opts *DialOptions) (*Conn, *http.Response, error) {
	if opts == nil {
		opts = &DialOptions{}
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, nil, fmt.Errorf("dial: parse url %q: %w", rawURL, err)
	}

	useTLS := false
	host := u.Host
	switch u.Scheme {
	case "ws":
		if !strings.Contains(host, ":") {
			host += ":80"
		}
	case "wss":
		useTLS = true
		if !strings.Contains(host, ":") {
			host += ":443"
		}
	default:
		return nil, nil, fmt.Errorf("dial: unsupported scheme %q", u.Scheme)
	}

	// Dial with context cancellation support.
	dialer := &net.Dialer{}
	rawConn, err := dialer.DialContext(ctx, "tcp", host)
	if err != nil {
		return nil, nil, fmt.Errorf("dial tcp %s: %w", host, err)
	}

	var netConn net.Conn = rawConn
	if useTLS {
		tlsCfg := opts.TLSConfig
		if tlsCfg == nil {
			tlsCfg = &tls.Config{ServerName: u.Hostname()} //nolint:gosec
		}
		tlsConn := tls.Client(rawConn, tlsCfg)
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			rawConn.Close()
			return nil, nil, fmt.Errorf("tls handshake: %w", err)
		}
		netConn = tlsConn
	}

	// Generate random nonce.
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		netConn.Close()
		return nil, nil, err
	}
	key := base64.StdEncoding.EncodeToString(nonce)

	requestPath := u.RequestURI()
	if requestPath == "" {
		requestPath = "/"
	}

	var sb strings.Builder
	sb.WriteString("GET ")
	sb.WriteString(requestPath)
	sb.WriteString(" HTTP/1.1\r\nHost: ")
	sb.WriteString(u.Host)
	sb.WriteString("\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ")
	sb.WriteString(key)
	sb.WriteString("\r\nSec-WebSocket-Version: 13\r\n")
	if len(opts.Subprotocols) > 0 {
		sb.WriteString("Sec-WebSocket-Protocol: ")
		sb.WriteString(strings.Join(opts.Subprotocols, ", "))
		sb.WriteString("\r\n")
	}
	for k, v := range opts.ExtraHeaders {
		sb.WriteString(k)
		sb.WriteString(": ")
		sb.WriteString(v)
		sb.WriteString("\r\n")
	}
	sb.WriteString("\r\n")

	if _, err := netConn.Write([]byte(sb.String())); err != nil {
		netConn.Close()
		return nil, nil, fmt.Errorf("dial write request: %w", err)
	}

	br := bufio.NewReaderSize(netConn, 4096)
	resp, err := http.ReadResponse(br, nil)
	if err != nil {
		netConn.Close()
		return nil, nil, fmt.Errorf("dial read response: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		netConn.Close()
		return nil, resp, fmt.Errorf("dial: unexpected status %d (want 101)", resp.StatusCode)
	}

	h := sha1.New() //nolint:gosec
	h.Write([]byte(key + wsGUID))
	expected := base64.StdEncoding.EncodeToString(h.Sum(nil))
	if got := resp.Header.Get("Sec-Websocket-Accept"); got != expected {
		netConn.Close()
		return nil, resp, fmt.Errorf("dial: invalid Sec-Websocket-Accept: got %q want %q", got, expected)
	}

	bw := bufio.NewWriterSize(netConn, 4096)
	conn := &Conn{
		conn:   netConn,
		rw:     bufio.NewReadWriter(br, bw),
		doneCh: make(chan struct{}),
	}
	return conn, resp, nil
}
