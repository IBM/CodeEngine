package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"sync"
)

func main() {
	// Get the namespace we're in so we know how to talk to the App
	file := "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
	namespace, err := ioutil.ReadFile(file)
	if err != nil || len(namespace) == 0 {
		fmt.Fprintf(os.Stderr, "Missing namespace: %s\n%s\n", err, namespace)
		os.Exit(1)
	}

	count := 10
	fmt.Printf("Sending %d requests...\n", count)
	wg := sync.WaitGroup{}

	// URL to the App
	url := "http://app." + string(namespace) + ".svc.cluster.local"

	// Do all requests to the App in parallel - why not?
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := http.Post(url, "", nil)

			// Something went wrong
			if err != nil || res.StatusCode > 299 {
				fmt.Fprintf(os.Stderr, "%d: %s\n%#v\n", i, err, res)
			}
		}()
	}

	// Wait for all threads to finish before we exit
	wg.Wait()

	fmt.Printf("Done\n")
}
