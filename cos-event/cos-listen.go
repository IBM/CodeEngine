package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"
)

type EventStats struct {
	ByBucket map[string]int `json:"by_bucket,omitempty"`
	ByType   map[string]int `json:"by_type,omitempty"`
	ByObject map[string]int `json:"by_object,omitempty"`
}

type COSEvent struct {
	Bucket       string            `json:"bucket"`
	Endpoint     string            `json:"endpoint,omitempty"`
	Key          string            `json:"key"`
	Notification EventNotification `json:"notification"`
	Operation    string            `json:"operation"`
}

type EventNotification struct {
	BucketName   string `json:"bucket_name"`
	EventType    string `json:"event_type"`
	Format       string `json:"format"`
	ObjectETag   string `json:"object_etag"`
	ObjectLength string `json:"object_length"`
	ObjectName   string `json:"object_name"`
	RequestID    string `json:"request_id"`
	RequestTime  string `json:"request_time"`
}

func main() {
	stats := EventStats{
		ByBucket: make(map[string]int),
		ByType:   make(map[string]int),
		ByObject: make(map[string]int),
	}

	http.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		responseBytes, _ := json.Marshal(stats)
		w.Write(responseBytes)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		daTime := time.Now().Format("2006-01-02 15:04:05")
		body := []byte{}

		if r.Body != nil {
			body, _ = ioutil.ReadAll(r.Body)
			var event COSEvent
			json.Unmarshal(body, &event)

			stats.ByBucket[event.Bucket] += 1
			stats.ByType[event.Operation] += 1
			stats.ByObject[event.Key] += 1
		}

		fmt.Printf("%s - Received:\n", daTime)
		fmt.Printf("\nBody: %s\n", string(body))
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
