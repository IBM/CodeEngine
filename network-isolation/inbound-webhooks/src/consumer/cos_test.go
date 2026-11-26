package main

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func fakeJWT(claims string) string {
	enc := base64.RawURLEncoding
	return enc.EncodeToString([]byte(`{"alg":"none"}`)) + "." + enc.EncodeToString([]byte(claims)) + ".sig"
}

func TestJWTExpiry(t *testing.T) {
	got, err := jwtExpiry(fakeJWT(`{"sub":"x","exp":1795000000}`))
	if err != nil {
		t.Fatalf("jwtExpiry() error = %v", err)
	}
	if want := time.Unix(1795000000, 0); !got.Equal(want) {
		t.Fatalf("jwtExpiry() = %v, want %v", got, want)
	}
}

func TestJWTExpiryErrors(t *testing.T) {
	tests := []struct {
		name  string
		token string
		want  string
	}{
		{"not a JWT", "opaque-token", "not a JWT"},
		{"invalid base64", "a.!!!.c", "cannot decode"},
		{"invalid JSON", fakeJWT("not json"), "cannot parse"},
		{"no exp claim", fakeJWT(`{"sub":"x"}`), "no exp claim"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := jwtExpiry(tt.token)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("jwtExpiry() error = %v, want it to contain %q", err, tt.want)
			}
		})
	}
}
