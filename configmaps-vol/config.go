package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Find all of the files in the /myconfig dir

		files, err := ioutil.ReadDir("/myconfig")
		if err != nil {
			fmt.Fprintf(w, "Can't read files in /myconfig: %s\n", err)
			return
		}

		for _, file := range files {
			// Skip files that start with a dot(.)
			if file.Name()[0] == '.' {
				continue
			}

			// Print the FILE-NAME: <file-contents>
			data, _ := ioutil.ReadFile("/myconfig/" + file.Name())
			fmt.Printf("%s: %s\n", file.Name(), string(data))
		}
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
