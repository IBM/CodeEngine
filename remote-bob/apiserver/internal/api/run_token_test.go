package api

import (
	"strings"
	"testing"
	"time"
)

func testRunKey() []byte {
	// 32-byte key for HMAC-SHA256.
	return []byte("0123456789abcdef0123456789abcdef")
}

func TestRunToken_IssueAndValidate(t *testing.T) {
	mgr := NewRunTokenManager(testRunKey(), 24*time.Hour)
	token, err := mgr.Issue("agent-1")
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	if token == "" {
		t.Fatal("Issue() returned empty token")
	}
	if !mgr.Validate(token, "agent-1") {
		t.Error("Validate() should accept a freshly issued token for its agent")
	}
}

func TestRunToken_BoundToAgent(t *testing.T) {
	mgr := NewRunTokenManager(testRunKey(), 24*time.Hour)
	token, err := mgr.Issue("agent-1")
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	if mgr.Validate(token, "agent-2") {
		t.Error("cross-agent use of a run token must be rejected")
	}
	if mgr.Validate(token, "") {
		t.Error("empty agent ID must be rejected")
	}
}

func TestRunToken_InvalidTokensRejected(t *testing.T) {
	mgr := NewRunTokenManager(testRunKey(), 24*time.Hour)
	token, _ := mgr.Issue("agent-1")

	invalid := []string{
		"",
		"garbage",
		"not-a-token",
		"a.b.c", // wrong number of parts
		strings.Replace(token, token[:4], "zzzz", 1), // tampered payload
	}
	for _, tok := range invalid {
		if mgr.Validate(tok, "agent-1") {
			t.Errorf("Validate(%q) should be rejected", tok)
		}
	}
}

func TestRunToken_TamperedSignatureRejected(t *testing.T) {
	mgr := NewRunTokenManager(testRunKey(), 24*time.Hour)
	token, _ := mgr.Issue("agent-1")

	// Flip a character in the signature portion.
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		t.Fatalf("unexpected token format: %q", token)
	}
	sig := parts[1]
	flipped := "A" + sig[1:]
	tampered := parts[0] + "." + flipped
	if mgr.Validate(tampered, "agent-1") {
		t.Error("tampered signature must be rejected")
	}
}

func TestRunToken_Expiry(t *testing.T) {
	now := time.Now()
	mgr := NewRunTokenManager(testRunKey(), 24*time.Hour)
	mgr.now = func() time.Time { return now }

	token, err := mgr.Issue("agent-1")
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}

	// Advance past the 24h TTL.
	mgr.now = func() time.Time { return now.Add(24*time.Hour + time.Second) }
	if mgr.Validate(token, "agent-1") {
		t.Error("expired run token must be rejected")
	}
}

func TestRunToken_SurvivesRestart(t *testing.T) {
	// A new manager with the same key (simulating an apiserver restart) must
	// validate tokens issued before the restart.
	mgr1 := NewRunTokenManager(testRunKey(), 24*time.Hour)
	token, err := mgr1.Issue("agent-1")
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}

	mgr2 := NewRunTokenManager(testRunKey(), 24*time.Hour)
	if !mgr2.Validate(token, "agent-1") {
		t.Error("run token must survive restart (stateless HMAC with stable key)")
	}
	if mgr2.Validate(token, "agent-2") {
		t.Error("run token must stay bound to its agent across restart")
	}
}

func TestRunToken_ReusableWithinTTL(t *testing.T) {
	mgr := NewRunTokenManager(testRunKey(), 24*time.Hour)
	token, _ := mgr.Issue("agent-1")

	// Stateless tokens are reusable: validation does not consume them.
	for i := 0; i < 5; i++ {
		if !mgr.Validate(token, "agent-1") {
			t.Fatalf("Validate() iteration %d should succeed (reusable)", i)
		}
	}
}

func TestRunToken_NoKeyFailsClosed(t *testing.T) {
	mgr := NewRunTokenManager(nil, 24*time.Hour)
	if _, err := mgr.Issue("agent-1"); err == nil {
		t.Error("Issue() without a signing key must fail")
	}
	if mgr.Validate("anything.anything", "agent-1") {
		t.Error("Validate() without a signing key must fail closed")
	}
}

func TestRunToken_TypeSeparation(t *testing.T) {
	// A WS token (random hex) must never validate as a run token.
	mgr := NewRunTokenManager(testRunKey(), 24*time.Hour)
	wsToken, err := randomToken()
	if err != nil {
		t.Fatalf("randomToken() error: %v", err)
	}
	if mgr.Validate(wsToken, "agent-1") {
		t.Error("a WS token must not validate as a run token")
	}
}
