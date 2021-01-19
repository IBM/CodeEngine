package main

import (
	"fmt"
	"net/http"
	"os"
	"sort"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Sort the env vars
		envs := os.Environ()
		sort.Strings(envs)

		// And print them
		fmt.Printf("Environment variables:\n")
		for _, e := range envs {
			fmt.Printf("%s\n", e)
		}
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
