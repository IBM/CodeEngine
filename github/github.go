package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
)

// To verify events are from out github webhook set this to the "secert"
// we set on the github webhook. Leave it blank to skip the check.
var GitHubSecret = os.Getenv("GIT_SECRET")

// Verify the incoming github event by checking its signature against
// the SHA of the body, using our GIT_SECRET as the key
func VerifyEvent(req *http.Request, body []byte, secret string) bool {
	sig := req.Header.Get("X-HUB-SIGNATURE")
	if len(sig) != 45 || sig[:5] != "sha1=" {
		return false
	}
	calc := make([]byte, 20)
	hex.Decode(calc, []byte(sig[5:]))
	mac := hmac.New(sha1.New, []byte(secret))
	mac.Write(body)
	return hmac.Equal(calc, mac.Sum(nil))
}

// Do whatever logic we need for the incoming event
func ProcessEvent(eventType string, eventBody []byte) {
	log.Printf("Event Type: %s", eventType)

	// Only care about "push" events
	if eventType != "push" {
		log.Print("Not a 'push' event so exit")
		return
	}

	pretty, _ := json.MarshalIndent(json.RawMessage(eventBody), "", "  ")
	log.Printf("\nEvent:\n%s", string(pretty))

	// The following sample JSON is just a subset of the data in the event,
	// but has the key bits we care about:
	//
	// {
	//   "ref": "refs/heads/master",
	//   "before": "--commit-ID--",
	//   "after": "--commit-ID--",
	//   "repository": {
	//     "name": "CodeEngine",
	//     "full_name": "IBM/CodeEngin,
	//   }
	//   "pusher": {
	//     "name": "github-id",
	//     "email": "user-email"
	//   },
	//   "sender": {},
	//   "commits": []
	// }

	// Define a var/struct to hold the parsed event data
	PushEvent := struct {
		Ref   string
		After string
		Repo  struct {
			Name     string
			FullName string
		}
		Pusher struct {
			Name  string
			Email string
		}
	}{}

	// Parse the event data into the PushEvent object
	err := json.Unmarshal(eventBody, &PushEvent)
	if err != nil {
		log.Printf("Error parsing:\n%s\n%s", err, string(eventBody))
		return
	}

	// Only care about pushes to the "main" branch
	if PushEvent.Ref != "refs/heads/main" {
		log.Printf("Skipping branch: %s", PushEvent.Ref)
		return
	}

	log.Printf("%s commited %q to %q branch",
		PushEvent.Pusher.Name, PushEvent.After, PushEvent.Ref)

	// Now we'd normally do a build, but let's just fake it.
	// To see how to kick off CodeEngine CLI commands from inside of an app
	// see the "cecli" sample.
	log.Print("ibmcloud ce buildrun submit ...")
}

// Simple web server that waits for incoming events, verifies they're
// from our webhook (by using the GIT_SECRET, if set) and if ok process it
func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		body, _ := ioutil.ReadAll(r.Body)

		// Make sure it comes from our repo (if we want to check it at all)
		if GitHubSecret != "" && !VerifyEvent(r, body, GitHubSecret) {
			log.Printf("Error verifying github event")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		ProcessEvent(r.Header.Get("X-Github-Event"), body)
	})

	log.Printf("Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
