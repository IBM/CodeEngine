// webhook-consumer receives IBM Cloud Object Storage events from a Code Engine
// subscription, reads the referenced object (a webhook envelope written by
// webhook-receiver) and logs meaningful data from it.
//
// It answers 2xx only if the object was read and parsed successfully, and
// non-2xx otherwise. It never deletes or modifies objects.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

const maxEventBytes = 1 << 20 // COS event notifications are small

// cosEvent is the HTTP body of a Code Engine Object Storage event.
type cosEvent struct {
	Bucket       string `json:"bucket"`
	Key          string `json:"key"`
	Operation    string `json:"operation"`
	Notification struct {
		EventType    string `json:"event_type"`
		ObjectLength string `json:"object_length"`
		RequestID    string `json:"request_id"`
	} `json:"notification"`
}

// --- Your business logic: adapt this block for your webhook payloads ---------

// payloadSummary holds the few GitHub payload fields that are logged.
type payloadSummary struct {
	Action     string `json:"action"`
	Ref        string `json:"ref"`
	Zen        string `json:"zen"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
	Sender struct {
		Login string `json:"login"`
	} `json:"sender"`
}

// process handles one stored delivery and returns a one-line summary for the log.
// Return an error to answer non-2xx, which Code Engine treats as a failed event delivery.
// The sample only logs; do something useful with the payload here.
func process(key string, env envelope) (string, error) {
	var p payloadSummary
	if err := json.Unmarshal(env.Payload, &p); err != nil {
		return "", fmt.Errorf("payload is not a JSON object: %w", err)
	}

	fields := []string{
		"key=" + key,
		"delivery=" + env.DeliveryID,
		"event=" + env.Event,
		"received_at=" + env.ReceivedAt,
	}
	for _, f := range []struct{ name, value string }{
		{"action", p.Action},
		{"repository", p.Repository.FullName},
		{"sender", p.Sender.Login},
		{"ref", p.Ref},
		{"zen", p.Zen},
	} {
		if f.value != "" {
			fields = append(fields, fmt.Sprintf("%s=%q", f.name, f.value))
		}
	}
	fields = append(fields, fmt.Sprintf("payload_bytes=%d", len(env.Payload)))
	return strings.Join(fields, " "), nil
}

// -----------------------------------------------------------------------------

type consumer struct {
	bucket string
	store  objectGetter
}

func (c *consumer) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var ev cosEvent
	dec := json.NewDecoder(http.MaxBytesReader(w, req.Body, maxEventBytes))
	if err := dec.Decode(&ev); err != nil {
		log.Printf("cannot parse event (ce-id=%s): %v", req.Header.Get("Ce-Id"), err)
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	log.Printf("event ce-id=%s ce-type=%s bucket=%s key=%s operation=%s",
		req.Header.Get("Ce-Id"), req.Header.Get("Ce-Type"), ev.Bucket, ev.Key, ev.Operation)

	// only new/updated objects are of interest
	if ev.Operation != "Object:Write" {
		log.Printf("ignoring operation %q for key %s", ev.Operation, ev.Key)
		fmt.Fprintln(w, "ignored")
		return
	}
	if ev.Bucket != c.bucket || ev.Key == "" {
		log.Printf("rejecting event for unexpected bucket %q or empty key %q", ev.Bucket, ev.Key)
		http.Error(w, "unexpected bucket or key", http.StatusBadRequest)
		return
	}

	data, err := c.store.Get(req.Context(), ev.Bucket, ev.Key)
	if err != nil {
		log.Printf("ERROR key=%s: reading object failed: %v", ev.Key, err)
		http.Error(w, "reading object failed", http.StatusInternalServerError)
		return
	}
	env, err := parseEnvelope(data)
	if err != nil {
		log.Printf("ERROR key=%s: %v", ev.Key, err)
		http.Error(w, "processing failed", http.StatusInternalServerError)
		return
	}
	summary, err := process(ev.Key, env)
	if err != nil {
		log.Printf("ERROR key=%s: %v", ev.Key, err)
		http.Error(w, "processing failed", http.StatusInternalServerError)
		return
	}

	log.Printf("processed webhook %s", summary)
	fmt.Fprintln(w, "processed")
}

func main() {
	bucket := mustEnv("COS_BUCKET")

	log.Printf("reading from bucket %s", bucket)
	serve("webhook-consumer", &consumer{bucket: bucket, store: &cosGetter{client: newCOSClient()}})
}
