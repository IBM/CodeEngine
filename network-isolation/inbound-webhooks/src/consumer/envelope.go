package main

import (
	"encoding/json"
	"fmt"
)

// envelope is the object webhook-receiver (src/receiver/main.js) writes to COS and webhook-consumer reads.
type envelope struct {
	ReceivedAt string              `json:"received_at"`
	DeliveryID string              `json:"delivery_id"`
	Event      string              `json:"event"`
	Headers    map[string][]string `json:"headers"`
	Payload    json.RawMessage     `json:"payload"`
}

func parseEnvelope(data []byte) (envelope, error) {
	var env envelope
	if err := json.Unmarshal(data, &env); err != nil {
		return env, fmt.Errorf("object is not a valid envelope: %w", err)
	}
	if env.DeliveryID == "" || env.Event == "" || len(env.Payload) == 0 {
		return env, fmt.Errorf("envelope is incomplete (delivery_id, event and payload are required)")
	}
	return env, nil
}
