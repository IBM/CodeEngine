package api

import (
	"sync"
	"time"
)

// RelayTokenStore issues one-time, short-lived relay tokens. A token is
// consumed (deleted) on first use, so a second use — even after a failed
// first dial — is rejected.
type RelayTokenStore struct {
	mu     sync.Mutex
	tokens map[string]time.Time
	ttl    time.Duration
	now    func() time.Time
	stopCh chan struct{}
	once   sync.Once
	wg     sync.WaitGroup
}

// NewRelayTokenStore creates a relay token store with the given TTL.
func NewRelayTokenStore(ttl time.Duration) *RelayTokenStore {
	s := &RelayTokenStore{
		tokens: make(map[string]time.Time),
		ttl:    ttl,
		now:    time.Now,
		stopCh: make(chan struct{}),
	}
	s.wg.Add(1)
	go s.sweepLoop()
	return s
}

// Issue creates a new one-time relay token.
func (s *RelayTokenStore) Issue() (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens[hashToken(token)] = s.now().Add(s.ttl)
	return token, nil
}

// Consume atomically validates and consumes a token. It returns true exactly
// once per issued token.
func (s *RelayTokenStore) Consume(token string) bool {
	if token == "" {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := hashToken(token)
	expiresAt, ok := s.tokens[key]
	if !ok {
		return false
	}
	delete(s.tokens, key)
	return !s.now().After(expiresAt)
}

// Revoke removes a token from the store if it has not been consumed yet.
// Used when a browser disconnects before the agent dials the relay, so a
// late agent dial is rejected.
func (s *RelayTokenStore) Revoke(token string) {
	if token == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tokens, hashToken(token))
}

func (s *RelayTokenStore) sweepLoop() {
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

func (s *RelayTokenStore) sweep() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for k, expiresAt := range s.tokens {
		if now.After(expiresAt) {
			delete(s.tokens, k)
		}
	}
}

// Stop stops the background sweeper.
func (s *RelayTokenStore) Stop() {
	s.once.Do(func() {
		close(s.stopCh)
		s.wg.Wait()
	})
}
