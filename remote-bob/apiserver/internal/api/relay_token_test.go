package api

import (
	"sync"
	"testing"
	"time"
)

func TestRelayTokenStore_IssueAndConsume(t *testing.T) {
	store := NewRelayTokenStore(60 * time.Second)
	defer store.Stop()

	token, err := store.Issue()
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	if token == "" {
		t.Fatal("Issue() returned empty token")
	}

	if !store.Consume(token) {
		t.Error("first Consume should succeed")
	}
	if store.Consume(token) {
		t.Error("second Consume should fail (one-time)")
	}
}

func TestRelayTokenStore_InvalidRejected(t *testing.T) {
	store := NewRelayTokenStore(60 * time.Second)
	defer store.Stop()

	if store.Consume("") {
		t.Error("empty token should be rejected")
	}
	if store.Consume("garbage") {
		t.Error("unknown token should be rejected")
	}
}

func TestRelayTokenStore_Expiry(t *testing.T) {
	now := time.Now()
	store := NewRelayTokenStore(60 * time.Second)
	defer store.Stop()
	store.now = func() time.Time { return now }

	token, err := store.Issue()
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}

	store.now = func() time.Time { return now.Add(61 * time.Second) }
	if store.Consume(token) {
		t.Error("expired relay token should be rejected")
	}
}

func TestRelayTokenStore_ConcurrentConsume(t *testing.T) {
	store := NewRelayTokenStore(60 * time.Second)
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
