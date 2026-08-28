package api

import (
	"sync"
	"testing"
	"time"
)

func TestWSTokenStore_IssueAndConsume(t *testing.T) {
	store := NewWSTokenStore(60 * time.Second)
	defer store.Stop()

	token, err := store.Issue()
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	if token == "" {
		t.Fatal("Issue() returned empty token")
	}
	if len(token) < 32 {
		t.Errorf("token too short: %d chars (want >= 32)", len(token))
	}

	if !store.Consume(token) {
		t.Error("first Consume of a fresh token should succeed")
	}
	if store.Consume(token) {
		t.Error("second Consume of the same token should fail (single-use)")
	}
}

func TestWSTokenStore_UnknownTokenRejected(t *testing.T) {
	store := NewWSTokenStore(60 * time.Second)
	defer store.Stop()

	if store.Consume("garbage-token") {
		t.Error("Consume of an unknown token should fail")
	}
	if store.Consume("") {
		t.Error("Consume of an empty token should fail")
	}
}

func TestWSTokenStore_Expiry(t *testing.T) {
	now := time.Now()
	store := NewWSTokenStore(60 * time.Second)
	defer store.Stop()
	store.now = func() time.Time { return now }

	token, err := store.Issue()
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}

	// Advance past the TTL.
	store.now = func() time.Time { return now.Add(61 * time.Second) }
	if store.Consume(token) {
		t.Error("Consume of an expired token should fail")
	}
}

func TestWSTokenStore_ExpiryBoundary(t *testing.T) {
	now := time.Now()
	store := NewWSTokenStore(60 * time.Second)
	defer store.Stop()
	store.now = func() time.Time { return now }

	token, err := store.Issue()
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}

	// Exactly at the TTL boundary the token is still valid.
	store.now = func() time.Time { return now.Add(60 * time.Second) }
	if !store.Consume(token) {
		t.Error("Consume at the exact TTL boundary should succeed")
	}
}

func TestWSTokenStore_ConcurrentConsumeRaceSafe(t *testing.T) {
	store := NewWSTokenStore(60 * time.Second)
	defer store.Stop()

	token, err := store.Issue()
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}

	const n = 20
	var wg sync.WaitGroup
	results := make([]bool, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i] = store.Consume(token)
		}(i)
	}
	wg.Wait()

	successes := 0
	for _, ok := range results {
		if ok {
			successes++
		}
	}
	if successes != 1 {
		t.Errorf("exactly one concurrent Consume should succeed, got %d", successes)
	}
}

func TestWSTokenStore_ConcurrentIssueDistinct(t *testing.T) {
	store := NewWSTokenStore(60 * time.Second)
	defer store.Stop()

	const n = 20
	var wg sync.WaitGroup
	tokens := make([]string, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			token, err := store.Issue()
			if err != nil {
				t.Errorf("Issue() error: %v", err)
				return
			}
			tokens[i] = token
		}(i)
	}
	wg.Wait()

	seen := make(map[string]bool)
	for _, token := range tokens {
		if token == "" {
			t.Fatal("Issue() returned an empty token")
		}
		if seen[token] {
			t.Fatal("concurrent Issue() returned duplicate tokens")
		}
		seen[token] = true
	}

	// Each token is usable exactly once.
	for _, token := range tokens {
		if !store.Consume(token) {
			t.Errorf("token %q should be consumable once", token)
		}
		if store.Consume(token) {
			t.Errorf("token %q should not be consumable twice", token)
		}
	}
}

func TestWSTokenStore_RestartInvalidates(t *testing.T) {
	// A restart creates a fresh store; previously issued tokens are gone.
	store1 := NewWSTokenStore(60 * time.Second)
	token, err := store1.Issue()
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	store1.Stop()

	store2 := NewWSTokenStore(60 * time.Second)
	defer store2.Stop()
	if store2.Consume(token) {
		t.Error("a token issued before restart must be rejected after restart")
	}
}

func TestWSTokenStore_Entropy(t *testing.T) {
	// Tokens must be high-entropy (>= 128 bits). 32 random bytes hex-encoded
	// is 256 bits; verify the raw length and that tokens differ.
	store := NewWSTokenStore(60 * time.Second)
	defer store.Stop()

	a, _ := store.Issue()
	b, _ := store.Issue()
	if a == b {
		t.Fatal("two issued tokens must differ")
	}
	// 32 bytes -> 64 hex chars.
	if len(a) != 64 || len(b) != 64 {
		t.Errorf("expected 64-char hex tokens, got %d and %d", len(a), len(b))
	}
}
