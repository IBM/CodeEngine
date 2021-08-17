package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"sort"
	"time"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		daTime := time.Now().Format("2006-01-02 15:04:05")
		body := []byte{}

		if r.Body != nil {
			body, _ = ioutil.ReadAll(r.Body)
		}

		fmt.Printf("%s - Received:\n", daTime)
		fmt.Printf("URL: %s\n", r.URL.String())

		// Sort the HTTP Headers
		keys := []string{}
		for k, _ := range r.Header {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		// Now print the incoming event (headers then body)
		for _, k := range keys {
			fmt.Printf("Header: %s=%v\n", k, r.Header[k])
		}
		fmt.Printf("\nBody: %s\n", string(body))
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
