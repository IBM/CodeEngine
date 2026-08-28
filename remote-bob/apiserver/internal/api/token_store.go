package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// wsTokenEntry is a single issued WS token.
type wsTokenEntry struct {
	expiresAt time.Time
	used      bool
}

// WSTokenStore issues and validates single-use, short-lived WS tokens.
// Tokens are stored in memory keyed by their SHA-256 hash; a restart
// invalidates all outstanding tokens. Consumption is atomic, so exactly one
// of N concurrent consumers of the same token succeeds.
type WSTokenStore struct {
	mu       sync.Mutex
	tokens   map[string]wsTokenEntry
	ttl      time.Duration
	now      func() time.Time
	stopCh   chan struct{}
	stopOnce sync.Once
	wg       sync.WaitGroup
}

// NewWSTokenStore creates a token store with the given TTL.
func NewWSTokenStore(ttl time.Duration) *WSTokenStore {
	s := &WSTokenStore{
		tokens: make(map[string]wsTokenEntry),
		ttl:    ttl,
		now:    time.Now,
		stopCh: make(chan struct{}),
	}
	s.wg.Add(1)
	go s.sweepLoop()
	return s
}

// TTL returns the token lifetime.
func (s *WSTokenStore) TTL() time.Duration { return s.ttl }

// Issue generates a new single-use token valid for the store's TTL.
func (s *WSTokenStore) Issue() (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens[hashToken(token)] = wsTokenEntry{
		expiresAt: s.now().Add(s.ttl),
	}
	return token, nil
}

// Consume atomically validates and consumes a token. It returns true exactly
// once for any given token: a second concurrent or later call returns false.
// Expired or unknown tokens return false.
func (s *WSTokenStore) Consume(token string) bool {
	if token == "" {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := hashToken(token)
	entry, ok := s.tokens[key]
	if !ok {
		return false
	}
	if entry.used {
		return false
	}
	if s.now().After(entry.expiresAt) {
		delete(s.tokens, key)
		return false
	}
	entry.used = true
	s.tokens[key] = entry
	return true
}

func (s *WSTokenStore) sweepLoop() {
	defer s.wg.Done()
	ticker := time.NewTicker(s.ttl)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.sweep()
		case <-s.stopCh:
			return
		}
	}
}

func (s *WSTokenStore) sweep() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for k, e := range s.tokens {
		if now.After(e.expiresAt) {
			delete(s.tokens, k)
		}
	}
}

// Stop stops the background sweeper.
func (s *WSTokenStore) Stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		s.wg.Wait()
	})
}

// randomToken returns a 32-byte CSPRNG token hex-encoded (256 bits of
// entropy, well above the 128-bit minimum).
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
