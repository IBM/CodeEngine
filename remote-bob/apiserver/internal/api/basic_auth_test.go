package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBasicAuth_ValidCredentials(t *testing.T) {
	auth := NewBasicAuth("secret-password")
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("admin", "secret-password")
	w := httptest.NewRecorder()

	if !auth.Check(w, req) {
		t.Fatal("Check() should accept valid credentials")
	}
	if w.Code != http.StatusOK {
		t.Errorf("no response should be written on success, got status %d", w.Code)
	}
}

func TestBasicAuth_WrongPassword(t *testing.T) {
	auth := NewBasicAuth("secret-password")
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("admin", "wrong-password")
	w := httptest.NewRecorder()

	if auth.Check(w, req) {
		t.Fatal("Check() should reject a wrong password")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	if w.Header().Get("WWW-Authenticate") == "" {
		t.Error("401 response should include WWW-Authenticate")
	}
}

func TestBasicAuth_WrongUsername(t *testing.T) {
	auth := NewBasicAuth("secret-password")
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("attacker", "secret-password")
	w := httptest.NewRecorder()

	if auth.Check(w, req) {
		t.Fatal("Check() should reject a wrong username")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestBasicAuth_MissingCredentials(t *testing.T) {
	auth := NewBasicAuth("secret-password")
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	w := httptest.NewRecorder()

	if auth.Check(w, req) {
		t.Fatal("Check() should reject missing credentials")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestBasicAuth_MalformedHeader(t *testing.T) {
	auth := NewBasicAuth("secret-password")
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	// Malformed: not a valid Basic header.
	req.Header.Set("Authorization", "Basic not-base64!!!")
	w := httptest.NewRecorder()

	if auth.Check(w, req) {
		t.Fatal("Check() should reject a malformed Authorization header")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestBasicAuth_WrongUserAndWrongPassIndistinguishable(t *testing.T) {
	auth := NewBasicAuth("secret-password")

	wrongUser := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("attacker", "secret-password")
	auth.Check(wrongUser, req)

	wrongPass := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("admin", "wrong-password")
	auth.Check(wrongPass, req)

	if wrongUser.Code != wrongPass.Code {
		t.Errorf("status codes differ: %d vs %d", wrongUser.Code, wrongPass.Code)
	}
	if wrongUser.Body.String() != wrongPass.Body.String() {
		t.Errorf("bodies differ: %q vs %q", wrongUser.Body.String(), wrongPass.Body.String())
	}
}

func TestBasicAuth_FailsClosedWhenUnset(t *testing.T) {
	auth := NewBasicAuth("")
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("admin", "anything")
	w := httptest.NewRecorder()

	if auth.Check(w, req) {
		t.Fatal("Check() must fail closed when no password is configured")
	}
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestBasicAuth_FailsClosedWhenEmptyPassword(t *testing.T) {
	// An empty-string GATEWAY_PASSWORD is treated as unset.
	auth := NewBasicAuth("")
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.SetBasicAuth("admin", "")
	w := httptest.NewRecorder()

	if auth.Check(w, req) {
		t.Fatal("Check() must reject an empty password when GATEWAY_PASSWORD is empty")
	}
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}
