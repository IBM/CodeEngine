package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const sampleEnvelope = `{
  "received_at": "2026-11-13T12:00:00Z",
  "delivery_id": "72d3162e-cc78-11e3-81ab-4c9367dc0958",
  "event": "push",
  "headers": {"X-Github-Event": ["push"]},
  "payload": {"ref": "refs/heads/main", "repository": {"full_name": "octo/repo"}, "sender": {"login": "octocat"}}
}`

// describe runs the same steps as the handler: parse the envelope, then process it.
func describe(key string, data []byte) (string, error) {
	env, err := parseEnvelope(data)
	if err != nil {
		return "", err
	}
	return process(key, env)
}

func TestDescribe(t *testing.T) {
	got, err := describe("some-key.json", []byte(sampleEnvelope))
	if err != nil {
		t.Fatalf("describe() error: %v", err)
	}
	for _, want := range []string{
		"key=some-key.json",
		"delivery=72d3162e-cc78-11e3-81ab-4c9367dc0958",
		"event=push",
		`repository="octo/repo"`,
		`sender="octocat"`,
		`ref="refs/heads/main"`,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("summary %q does not contain %q", got, want)
		}
	}
}

func TestDescribeRejectsBadObjects(t *testing.T) {
	for name, data := range map[string]string{
		"not json":         `hello`,
		"missing fields":   `{"event":"push"}`,
		"payload not json": `{"delivery_id":"x","event":"push","payload":"text"}`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := describe("k", []byte(data)); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
}

type fakeGetter struct {
	data []byte
	err  error
	got  string
}

func (f *fakeGetter) Get(_ context.Context, bucket, key string) ([]byte, error) {
	f.got = bucket + "/" + key
	return f.data, f.err
}

func post(c *consumer, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	rec := httptest.NewRecorder()
	c.ServeHTTP(rec, req)
	return rec
}

const writeEvent = `{"bucket":"queue","key":"k.json","operation":"Object:Write","notification":{"event_type":"Object:Write"}}`

func TestHandlerSuccess(t *testing.T) {
	store := &fakeGetter{data: []byte(sampleEnvelope)}
	rec := post(&consumer{bucket: "queue", store: store}, writeEvent)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if store.got != "queue/k.json" {
		t.Fatalf("fetched %q, want queue/k.json", store.got)
	}
}

func TestHandlerFailuresAreNon2xx(t *testing.T) {
	tests := []struct {
		name  string
		store *fakeGetter
		body  string
		want  int
	}{
		{"read error", &fakeGetter{err: errors.New("boom")}, writeEvent, http.StatusInternalServerError},
		{"bad object", &fakeGetter{data: []byte("nope")}, writeEvent, http.StatusInternalServerError},
		{"bad event", &fakeGetter{}, `not json`, http.StatusBadRequest},
		{"other bucket", &fakeGetter{}, `{"bucket":"other","key":"k","operation":"Object:Write"}`, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := post(&consumer{bucket: "queue", store: tt.store}, tt.body); rec.Code != tt.want {
				t.Fatalf("status = %d, want %d", rec.Code, tt.want)
			}
		})
	}
}

func TestHandlerIgnoresDelete(t *testing.T) {
	store := &fakeGetter{}
	rec := post(&consumer{bucket: "queue", store: store}, `{"bucket":"queue","key":"k","operation":"Object:Delete"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if store.got != "" {
		t.Fatalf("object must not be fetched for delete events, fetched %q", store.got)
	}
}
