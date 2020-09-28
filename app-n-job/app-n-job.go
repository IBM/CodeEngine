package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	jobIndex := os.Getenv("JOB_INDEX")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello from app-n-job! I'm a web app!\n")
	})

	if jobIndex == "" {
		fmt.Printf("Listening on port 8080\n")
		http.ListenAndServe(":8080", nil)
	} else {
		fmt.Printf("Hello from app-n-job! I'm a batch job! Index: %s\n",
			jobIndex)
	}
}
