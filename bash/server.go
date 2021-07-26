package main

// This program is a simple HTTP server that will do 2 things:
// 1 - invoke an "init" app (/app/init) at start-up
// 2 - invoke an "app" app (/app/app) upon each HTTP request
// See the README for more info

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

var verbose = 1

func Debug(level int, msg string, args ...interface{}) {
	// Note: 0 == always print
	if level > verbose {
		return
	}
	log.Printf(msg, args...)
}

func Run(envs []string, input []byte, cmdStr string, args ...interface{}) (int, string) {
	Debug(1, "Running: %s", fmt.Sprint(cmdStr))
	cmd := exec.Command("/bin/sh", "-c", fmt.Sprintf(cmdStr, args...))
	if len(envs) != 0 {
		cmd.Env = os.Environ()
		cmd.Env = append(cmd.Env, envs...)
	}

	if input != nil {
		cmd.Stdin = bytes.NewReader(input)
	} else {
		cmd.Stdin = nil
	}

	buf, err := cmd.CombinedOutput()
	if err != nil {
		if len(buf) > 0 {
			buf = append(buf, []byte("\n")...)
		}
		buf = append(buf, []byte(err.Error()+"\n")...)
		Debug(2, "  Error: %s", err)
	}

	Debug(2, "Output:\n%s", string(buf))
	Debug(2, "Exit Code: %d", cmd.ProcessState.ExitCode())

	return cmd.ProcessState.ExitCode(), string(buf)
}

func main() {
	if os.Getenv("DEBUG") != "" {
		verbose = 2
	}

	if _, err := os.Stat("/app/init"); err == nil {
		Run(nil, nil, "/app/init")
	}

	if tmp := os.Getenv("INIT"); tmp != "" {
		Run(nil, nil, tmp)
	}

	Command := "/app/app"
	if tmp := os.Getenv("APP"); tmp != "" {
		Command = tmp
	}

	// Our HTTP handler func
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		Debug(1, "Request: %s -> %s", r.Method, r.URL)
		envs := []string{
			"METHOD=" + r.Method,
			"URL=" + r.URL.Path,
		}

		for k, v := range r.Header {
			k = strings.ReplaceAll(k, "-", "_")
			k = strings.ToUpper(k)
			envs = append(envs, fmt.Sprintf("HEADER_%s=%s", k, v))
		}

		body, _ := ioutil.ReadAll(r.Body)
		code, result := Run(envs, body, Command)

		if code != 0 {
			w.WriteHeader(http.StatusInternalServerError)
		}
		fmt.Fprintf(w, result)
	})

	Debug(1, "Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
