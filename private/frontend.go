package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
)

func main() {
	// Get our namespace (aka Code Engine project)
	ns := ""
	dir := "/var/run/secrets/kubernetes.io/serviceaccount"

	if buf, err := ioutil.ReadFile(dir + "/namespace"); err != nil {
		panic(fmt.Sprintf("Can't read namespace: %s\n", err))
	} else {
		ns = string(buf)
	}

	// Process incoming http request
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Calc backend URL and GET it
		backend := fmt.Sprintf("http://backend.%s.svc.cluster.local", ns)

		res, err := http.Get(backend)
		if err != nil || res.StatusCode/100 != 2 {
			w.WriteHeader(http.StatusInternalServerError)
			if err != nil {
				fmt.Fprintf(w, "Error reaching backend: %s\n", err)
			} else {
				fmt.Fprintf(w, "Error reaching backend: %s\n", res.Status)
			}
			return
		}

		body, _ := ioutil.ReadAll(res.Body)

		// Return nice response
		fmt.Fprint(w, "Hello from the front-end\n")
		fmt.Fprintf(w, "The backend says: %s\n", string(body))
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
