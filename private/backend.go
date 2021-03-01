package main

import (
	"fmt"
	"net/http"
	"time"
)

func main() {
	// Process incoming http request
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Just say HI along with the time
		fmt.Fprintf(w, "Hello from the backend. The time is now: %s\n",
			time.Now().Format(time.Kitchen))
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
