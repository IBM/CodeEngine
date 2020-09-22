package main

import (
	"fmt"
	"net/http"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "\n\nI was built with Code Engine!\n\n\n")
}

func main() {
	http.HandleFunc("/", Handler)
	fmt.Printf("Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
