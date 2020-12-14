package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

// Just a util func that will run the command and if it fails then it'll
// panic. Not really the right thing to do in a real app, but it makes it
// really nice for our main() to just call Run() and not have to check for
// errors after each call.
func Run(out *string, cmdStr string, args ...interface{}) string {
	log.Printf("> %s\n", fmt.Sprint(cmdStr))
	cmd := exec.Command("/bin/sh", "-c", fmt.Sprintf(cmdStr, args...))
	buf, err := cmd.CombinedOutput()
	if err != nil {
		buf = append(buf, []byte("\n"+err.Error()+"\n")...)
	}
	if out != nil {
		*out = *out + fmt.Sprintf("> %s\n%s\n", cmdStr, string(buf))
	}
	log.Printf(string(buf) + "\nDone")
	if err != nil {
		panic(err)
	}
	return string(buf)
}

func main() {
	// These are run during the start-up of the container so that
	// we don't have the pay the cost of this on each HTTP request
	Run(nil, "ibmcloud login -r us-south --apikey %s -g %s",
		strings.TrimSpace(os.Getenv("APIKEY")),
		strings.TrimSpace(os.Getenv("GROUP")))
	Run(nil, "ibmcloud ce project select -n %s", os.Getenv("PROJECT"))

	// Our HTTP handler func
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		result := ""

		// Just make sure the user asked for us to list the App
		if r.URL.Path != "/list" {
			return
		}

		defer func() {
			// On any Run() error (ie panic), return 500 to client
			if r := recover(); r != nil {
				w.WriteHeader(http.StatusInternalServerError)
			}
			// Either way, print the output of the Runs
			fmt.Fprint(w, result)
		}()

		// List of commands to run - can be any command, not just CE cmds
		Run(&result, "ibmcloud ce project current")
		Run(&result, "ibmcloud ce app list")
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
