package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

func Curl(url string) (string, error) {
	cmd := exec.Command("curl", "--http0.9", "-s", url)
	res, err := cmd.CombinedOutput()
	return string(res), err
}

var GlobalDebug = (os.Getenv("DEBUG") != "")

func Debug(doit bool, format string, args ...interface{}) {
	// If either is 'true' then print it
	if !GlobalDebug && !doit {
		return
	}

	format = time.Now().Format("2006-01-02 15:04:05 ") + format + "\n"
	fmt.Fprintf(os.Stderr, format, args...)
}

func main() {
	// If env var CRASH is set then crash immediately.
	// If it's value is of the form HH:MM then crash at the specified time
	// time. The time is based on time returned from: http://time.nist.gov:13
	if date := os.Getenv("CRASH"); date != "" { // Just crash!
		// get time: curl http://time.nist.gov:13
		// result  : 58859 20-01-11 21:28:24 00 0 0 129.3 UTC(NIST) *
		if len(date) > 3 && date[2] == ':' {
			if now, err := Curl("http://time.nist.gov:13"); err == nil {
				parts := strings.SplitN(now, " ", 4)
				if len(parts) > 3 {
					now = parts[2] // Just time part
					now = now[:len(date)]
					if now > date {
						os.Exit(1)
					}
				}
			} else {
				Debug(true, "Curl: %s\n%s", now, err)
			}
		} else {
			os.Exit(1)
		}
	}

	// hostname := os.Getenv("HOSTNAME")
	msg := os.Getenv("MSG")
	if msg == "" {
		target := os.Getenv("TARGET")
		if target == "" {
			target = "World"
		}
		msg = "Hello " + target + " from"
	}

	envs := os.Environ()
	sort.StringSlice(envs).Sort()
	env := strings.Join(envs, "\n")
	Debug(false, "Envs:\n%s", env)

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
			// http://patorjk.com/software/taag/#p=display&f=Graceful&t=Code%0AEngine
			fmt.Fprintf(w, `%s:
  ___  __  ____  ____             
 / __)/  \(    \(  __)            
( (__(  O )) D ( ) _)             
 \___)\__/(____/(____)            
 ____  __ _   ___  __  __ _  ____ 
(  __)(  ( \ / __)(  )(  ( \(  __)
 ) _) /    /( (_ \ )( /    / ) _) 
(____)\_)__) \___/(__)\_)__)(____)

`, msg)
			fmt.Fprintf(w, "Some Env Vars:\n")
			fmt.Fprintf(w, "--------------\n")
			for _, env := range envs {
				fmt.Fprintf(w, "%s\n", env)
			}
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
