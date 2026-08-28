package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const runTokenType = "run"

var errNoSigningKey = errors.New("run token signing key is not configured")

// RunTokenManager issues and validates stateless HMAC-signed run tokens.
// Tokens are bound to the agent ID they were issued for and carry a TTL.
// Because they are stateless, they survive apiserver restarts as long as the
// signing key is stable (ENCRYPTION_KEY).
type RunTokenManager struct {
	key []byte
	ttl time.Duration
	now func() time.Time
}

// NewRunTokenManager creates a run token manager.
func NewRunTokenManager(key []byte, ttl time.Duration) *RunTokenManager {
	return &RunTokenManager{key: key, ttl: ttl, now: time.Now}
}

// Issue creates a run token bound to the given agent ID.
func (m *RunTokenManager) Issue(agentID string) (string, error) {
	if len(m.key) == 0 {
		return "", errNoSigningKey
	}
	now := m.now().Unix()
	payload := struct {
		AgentID string `json:"agent_id"`
		IAT     int64  `json:"iat"`
		Exp     int64  `json:"exp"`
		Typ     string `json:"typ"`
	}{
		AgentID: agentID,
		IAT:     now,
		Exp:     now + int64(m.ttl.Seconds()),
		Typ:     runTokenType,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadBytes)
	return payloadB64 + "." + m.sign(payloadB64), nil
}

// Validate checks that the token is a valid run token for the given agent ID:
// correct HMAC signature (constant-time), correct type, unexpired, and bound
// to the agent ID.
func (m *RunTokenManager) Validate(token, agentID string) bool {
	if token == "" || agentID == "" {
		return false
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}
	payloadB64, sigB64 := parts[0], parts[1]

	received, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil {
		return false
	}
	expected := m.signBytes(payloadB64)
	if subtle.ConstantTimeCompare(expected, received) != 1 {
		return false
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return false
	}
	var payload struct {
		AgentID string `json:"agent_id"`
		Exp     int64  `json:"exp"`
		Typ     string `json:"typ"`
	}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return false
	}
	if payload.Typ != runTokenType {
		return false
	}
	if payload.AgentID != agentID {
		return false
	}
	if m.now().Unix() > payload.Exp {
		return false
	}
	return true
}

func (m *RunTokenManager) sign(payloadB64 string) string {
	return base64.RawURLEncoding.EncodeToString(m.signBytes(payloadB64))
}

func (m *RunTokenManager) signBytes(payloadB64 string) []byte {
	mac := hmac.New(sha256.New, m.key)
	mac.Write([]byte(payloadB64))
	return mac.Sum(nil)
}
