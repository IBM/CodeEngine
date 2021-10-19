package main

// Just a simple app to receive events and print them to it's logs

import (
	"io/ioutil"
	"log"
	"net/http"
	"sort"
)

// This func will handle all incoming HTTP requests
func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	log.Printf("----------")
	log.Printf("Path: %s", r.URL)

	// Print the HTTP headrs so people can see the event metadata
	headers := []string{}
	for k, _ := range r.Header {
		headers = append(headers, k)
	}
	sort.Strings(headers)
	for _, k := range headers {
		log.Printf("Header: %s=%s", k, r.Header[k])
	}

	// And now show the event data itself (in the HTTP body)
	body, _ := ioutil.ReadAll(r.Body)
	log.Printf("Event data: %s", string(body))
}

func main() {
	http.HandleFunc("/", HandleHTTP)
	log.Printf("Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
