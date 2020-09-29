package main

// Copyright Contributors to the Code Engine Samples project

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

// GlobalDebug can be set with env variable "DEBUG".
// Print debug output if true.
var GlobalDebug = (os.Getenv("DEBUG") != "")

// Debug prints debug output to stderr.
func Debug(doit bool, format string, args ...interface{}) {
	// If either is 'true' then print it
	if !GlobalDebug && !doit {
		return
	}

	format = time.Now().Format("2006-01-02 15:04:05 ") + format + "\n"
	fmt.Fprintf(os.Stderr, format, args...)
}

func application(msg string) {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		body := []byte{}
		debug := false

		// If there's a body then echo it back to the client
		if r.Body != nil {
			body, _ = ioutil.ReadAll(r.Body)
		}

		// Turn on debugging is the 'debug' query param is there. Just for
		// this request tho - unless global debug is set.
		if _, ok := r.URL.Query()["debug"]; ok {
			debug = true
		}

		Debug(debug, "%s:\n%s %s\nHeaders:\n%s\n\nBody:\n%s\n",
			time.Now().String(), r.Method, r.URL, r.Header, string(body))

		// If the 'sleep' query parameter is passed in then sleep for
		// that many seconds
		if t := r.URL.Query().Get("sleep"); t != "" {
			len, _ := strconv.Atoi(t)
			Debug(debug, "Sleeping %d", len)
			time.Sleep(time.Duration(len) * time.Second)
		}

		// If the 'crash' query parameter is passed in the crash!
		if r.URL.Query().Get("crash") != "" {
			Debug(debug, "Crashing...")
			os.Exit(1)
		}

		// If 'fail' query parameter is there then return it's value
		// as the HTTP return code, defaults to '500'
		if t, ok := r.URL.Query()["fail"]; ok {
			status := 500

			if t != nil && t[0] != "" {
				status, _ = strconv.Atoi(t[0])
			}
			Debug(debug, "Failing %d", status)
			w.WriteHeader(status)
		}

		if len(body) == 0 {
			w.Header().Add("Content-Type", "text/plain")
			fmt.Fprint(w, msg)
		} else {
			fmt.Fprintf(w, string(body)+"\n")
		}
	})

	// HTTP_DELAY will pause for 'delay' seconds before starting the
	// HTTP server. This is useful for simulating a log readiness probe
	if delay := os.Getenv("HTTP_DELAY"); delay != "" {
		if sec, _ := strconv.Atoi(delay); sec != 0 {
			Debug(false, "Sleeping %d seconds", sec)
			time.Sleep(time.Duration(sec) * time.Second)
		}
	}

	Debug(true, "Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}

func main() {
	// If env var CRASH is set then crash immediately.
	// If it's value is of the form HH:MM then crash at the specified time.
	if crashtime := os.Getenv("CRASH"); crashtime != "" { // Just crash!
		if len(crashtime) == 5 && crashtime[2] == ':' {
			now := time.Now().UTC().Format("15:04")
			Debug(true, "Crash time: %s, now: %s", crashtime, now)
			if now > crashtime {
				os.Exit(1)
			}
		} else {
			Debug(true, "Crash time: '%s', crash immediately", crashtime)
			os.Exit(1)
		}
	}

	// Prepare a greeting message.
	msg := os.Getenv("MSG")
	if msg == "" {
		target := os.Getenv("TARGET")
		if target == "" {
			target = "World"
		}
		msg = "Hello " + target + " from"
	}

	// Append Code Engine ASCII art.
	// http://patorjk.com/software/taag/#p=display&f=Graceful&t=Code%0AEngine
	msg = msg + `:
  ___  __  ____  ____             
 / __)/  \(    \(  __)            
( (__(  O )) D ( ) _)             
 \___)\__/(____/(____)            
 ____  __ _   ___  __  __ _  ____ 
(  __)(  ( \ / __)(  )(  ( \(  __)
 ) _) /    /( (_ \ )( /    / ) _) 
(____)\_)__) \___/(__)\_)__)(____)

`

	// Prepare the list of environment variables for output.
	// If env variable 'JOB_INDEX' is contained, this must be a job.
	// Otherwise, it's an application.
	env := os.Environ()
	sort.StringSlice(env).Sort()
	envs := ""
	app := true
	for _, e := range env {
		envs = envs + e + "\n"

		// Split into key-value pairs and introspect keys.
		kv := strings.SplitN(e, "=", 2)
		if len(kv) >= 1 && strings.ToUpper(kv[0]) == "JOB_INDEX" {
			app = false
		}
	}

	// Now prepare the full message
	msg = msg + "Some Env Vars:\n--------------\n" + envs

	if app {
		application(msg)
	} else {
		fmt.Print(msg)
	}
}
