package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"sync"
	"time"
)

func main() {
	count := 10
	fmt.Printf("Sending %d requests...\n", count)
	wg := sync.WaitGroup{}

	// URL to the App
	url := "http://j2a-app." + os.Getenv("CE_SUBDOMAIN") + ".svc.cluster.local"

	// Do all requests to the App in parallel - why not?
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				res, err := http.Post(url, "", nil)

				if err == nil && res.StatusCode/100 == 2 {
					break
				}

				// Something went wrong, pause and try again
				body := []byte{}
				if res != nil {
					body, _ = ioutil.ReadAll(res.Body)
				}
				fmt.Fprintf(os.Stderr, "%d: err: %s\nhttp res: %#v\nbody:%s",
					i, err, res, string(body))
				time.Sleep(time.Second)
			}
		}(i)
	}

	// Wait for all threads to finish before we exit
	wg.Wait()

	fmt.Printf("Done\n")
}
