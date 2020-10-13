package main

import (
	"fmt"
	"net/http"
	"os"
	"sort"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	// Just return the list of env vars
	envs := os.Environ()
	sort.Strings(envs)

	fmt.Fprintf(w, "Environment variables:\n")
	for _, v := range envs {
		fmt.Fprintf(w, "%s\n", v)
	}
}

func main() {
	http.HandleFunc("/", Handler)
	fmt.Printf("Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
