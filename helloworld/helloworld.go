package main

// If you're just starting out please see the "hello" sample instead. While
// this one is relatively simple, if has quite a few extra flags that can
// be set to control how the code behaves at runtime. So, this is great
// for debugging and exploring those options - but not great if you want
// to see the bare minimum needed to start an app.

// The main purpose of this is to run an App (http server), however, it
// can also be used as a Batch Job if the JOB_INDEX env var is set - which
// is set by the Code Engine batch processor. This can be useful if you want
// the same code to be used for both Apps and Jobs. In this respect it's
// very similar to the app-n-job sample, but this has all of the interesting
// debug/configuration flags that can be tweaked.

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func Curl(url string) (string, error) {
	cmd := exec.Command("curl", "--http0.9", "-s", url)
	res, err := cmd.CombinedOutput()
	return string(res), err
}

var GlobalDebug = (os.Getenv("DEBUG") != "")
var envs = []string{}
var msg = ""
var skips = []string{
	"KUBERNETES_",
	"K_CONFIG",
	"K_SERVICE",
}

func Debug(doit bool, format string, args ...interface{}) {
	// If either is 'true' then print it
	if !GlobalDebug && !doit {
		return
	}

	format = time.Now().Format("2006-01-02 15:04:05 ") + format + "\n"
	fmt.Fprintf(os.Stderr, format, args...)
}

// Just print an cool essage to the Writer that's passed in
func PrintMessage(w io.Writer, showAll bool) {
	fmt.Fprintf(w, "%s:\n", msg)
	fmt.Fprintln(w, `. ___  __  ____  ____`)
	fmt.Fprintln(w, `./ __)/  \(    \(  __)`)
	fmt.Fprintln(w, `( (__(  O )) D ( ) _)`)
	fmt.Fprintln(w, `.\___)\__/(____/(____)`)
	fmt.Fprintln(w, `.____  __ _   ___  __  __ _  ____`)
	fmt.Fprintln(w, `(  __)(  ( \ / __)(  )(  ( \(  __)`)
	fmt.Fprintln(w, `.) _) /    /( (_ \ )( /    / ) _)`)
	fmt.Fprintln(w, `(____)\_)__) \___/(__)\_)__)(____)`)
	fmt.Fprintln(w, "")

	fmt.Fprintf(w, "Some Env Vars:\n")
	fmt.Fprintf(w, "--------------\n")
	for _, env := range envs {
		if !showAll {
			skipIt := false
			for _, skip := range skips {
				if strings.HasPrefix(env, skip) {
					skipIt = true
					break
				}
			}
			if skipIt {
				continue
			}
		}
		fmt.Fprintf(w, "%s\n", env)
	}
}

// This func will handle all incoming HTTP requests
func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	body := []byte{}
	debug := false
	showAll := (os.Getenv("SHOW") != "")

	// If there's a body then read it in for later use
	if r.Body != nil {
		body, _ = io.ReadAll(r.Body)
	}

	// Turn on debugging if the 'debug' query param is there. Just for
	// this request tho - unless global debug is set.
	if _, ok := r.URL.Query()["debug"]; ok {
		debug = true
	}

	// Allow for people to enable 'showAll' on a per request basis
	if _, ok := r.URL.Query()["show"]; ok {
		showAll = true
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

	// If the 'crash' query parameter is passed in then crash!
	if r.URL.Query().Get("crash") != "" {
		Debug(debug, "Crashing...")
		os.Exit(1)
	}

	// If 'fail' query parameter is there then return its value
	// as the HTTP return code, defaults to '500'
	if t, ok := r.URL.Query()["fail"]; ok {
		status := 500

		if t != nil && t[0] != "" {
			status, _ = strconv.Atoi(t[0])
		}
		Debug(debug, "Failing with: %d", status)
		w.WriteHeader(status)
	}

	// If there's no 'body' then just print something neat.
	// But if there is a body, echo it back to the client.
	if len(body) == 0 {
		w.Header().Add("Content-Type", "text/plain")
		// http://patorjk.com/software/taag/#p=display&f=Graceful&t=Code%0AEngine
		PrintMessage(w, showAll)
	} else {
		fmt.Fprintf(w, string(body)+"\n")
	}
}

func main() {
	ctx := context.Background()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)

	// Just for fun
	if os.Getenv("SHOW") == "" {
		os.Setenv("z", "Set env var 'SHOW' to see all variables")
	}

	// If env var CRASH is set then crash immediately.
	// If its value is of the form HH:MM then crash at the specified time
	// time. The time is based on time returned from: http://time.nist.gov:13
	// This is useful for testing what happens if the app crashes during
	// startup. And the 'time' aspect of it allows for only certain instances
	// of the app to crash - for example, we want the app to be created ok
	// but then after a minute have any new instances crash.
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

	// Figure out what message we want to print. You can override this
	// via the "MSG" environment variable. Or, you can just change who
	// it says hello to via the "TARGET" environment variable
	msg = os.Getenv("MSG")
	if msg == "" {
		target := os.Getenv("TARGET")
		if target == "" {
			target = "World"
		}
		msg = "Hello " + target + " from"
	}

	// Get the list of env vars, and sort them for easy reading
	envs = os.Environ()
	sort.StringSlice(envs).Sort()
	Debug(false, "Envs:\n%s", strings.Join(envs, "\n"))

	// Real work.
	// If we're being run as a Batch Jobthen the JOB_INDEX env var
	// will be set. In which case, just print the message to stdout.
	// Otherwise we're an App and we need to start the HTTP server
	// to processing incoming requests
	if jobIndex := os.Getenv("JOB_INDEX"); jobIndex != "" {

		// Jobs can be either started in 'task' mode and run to completion or in 'daemon' mode which
		jobMode := os.Getenv("JOB_MODE")

		// Start a endless for loop
		for {
			sleep := os.Getenv("SLEEP")
			sleepDuration := 0
			if sleep != "" {
				sleepDuration, _ = strconv.Atoi(sleep)
			} else if jobMode == "daemon" {
				// Sleep for 60 seconds and then re-do the execution
				sleepDuration = 60
			}

			// Check whether the job should sleep a while before printing the helloworld statement
			if sleepDuration > 0 {
				Debug(false, "Sleeping %ds", sleepDuration)
				time.Sleep(time.Duration(sleepDuration) * time.Second)
			}

			fmt.Printf("Hello from helloworld! I'm a %s job! Index: %s\n\n", jobMode, jobIndex)
			PrintMessage(os.Stdout, os.Getenv("SHOW") == "")

			if jobMode == "task" {
				// If this job is of type task (aka run-to-completion), let it exit the loop
				break
			}
		}

	} else {
		srv := &http.Server{Addr: ":8080"}

		// Debug the http handler for all requests
		http.HandleFunc("/", HandleHTTP)

		// HTTP_DELAY will pause for 'delay' seconds before starting the
		// HTTP server. This is useful for simulating a long readiness probe
		if delay := os.Getenv("HTTP_DELAY"); delay != "" {
			if sec, _ := strconv.Atoi(delay); sec != 0 {
				Debug(false, "Sleeping %d seconds", sec)
				time.Sleep(time.Duration(sec) * time.Second)
			}
		}

		go func() {
			Debug(true, `. ___  __  ____  ____`)
			Debug(true, `./ __)/  \(    \(  __)`)
			Debug(true, `( (__(  O )) D ( ) _)`)
			Debug(true, `.\___)\__/(____/(____)`)
			Debug(true, `.____  __ _   ___  __  __ _  ____`)
			Debug(true, `(  __)(  ( \ / __)(  )(  ( \(  __)`)
			Debug(true, `.) _) /    /( (_ \ )( /    / ) _)`)
			Debug(true, `(____)\_)__) \___/(__)\_)__)(____)`)
			Debug(true, "")
			Debug(true, "An instance of application '%s' has been started :)", os.Getenv("CE_APP"))
			Debug(true, "Listening on port 8080")

			if err := srv.ListenAndServe(); err != http.ErrServerClosed {
				log.Fatalf("failed to start server: %v", err)
			}
		}()

		<-signals
		Debug(true, "shutting down server")
		if err := srv.Shutdown(ctx); err != nil {
			log.Fatalf("failed to shutdown server: %v", err)
		}
		Debug(true, "shutdown done")
	}
}
