package main

import (
	"fmt"
	"net/http"
)

// This func will handle all incoming HTTP requests
func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "You made it to the real app!\n")
}

func main() {
	fmt.Printf("Listening on port 8080\n")
	http.HandleFunc("/", HandleHTTP)
	http.ListenAndServe(":8080", nil)
}
