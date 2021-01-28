package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	jobIndex := os.Getenv("JOB_INDEX")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("log: app-n-job got an incoming request\n")
		fmt.Fprintf(w, "Hello from app-n-job! I'm a web app!\n")
	})

	if jobIndex == "" {
		log.Printf("Listening on port 8080\n")
		http.ListenAndServe(":8080", nil)
	} else {
		log.Printf("Hello from app-n-job! I'm a batch job! Index: %s\n",
			jobIndex)
	}
}
