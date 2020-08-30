package main

import (
	"fmt"
	"net/http"
	"sync/atomic"
)

var count = int64(0)

func Handler(w http.ResponseWriter, r *http.Request) {
	// Just return the count
	if r.Method == "GET" {
		fmt.Fprintf(w, "Count: %d\n", atomic.LoadInt64(&count))
	}

	// Either PUT or POST will increment the count
	if r.Method == "PUT" || r.Method == "POST" {
		atomic.AddInt64(&count, 1)
	}
}

func main() {
	http.HandleFunc("/", Handler)
	fmt.Printf("Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
