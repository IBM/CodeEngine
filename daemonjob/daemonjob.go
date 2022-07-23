package main

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

func main() {
	// Start a endless for loop
	for {
		// MSG env var allows you to edit our message
		msg := os.Getenv("MSG")
		if msg == "" {
			target := os.Getenv("TARGET")
			if target == "" {
				target = "World"
			}
			msg = "Hello " + target + "!"
		}

		// Just for debugging... show the env vars if DEBUG is set
		envs := os.Environ()
		sort.StringSlice(envs).Sort()
		fmt.Printf("Envs:\n%s\n", strings.Join(envs, "\n"))

		// If the 'SLEEP' env var is set then sleep for that many seconds
		if t := os.Getenv("SLEEP"); t != "" {
			len, _ := strconv.Atoi(t)
			fmt.Printf("Sleeping %d", len)
			time.Sleep(time.Duration(len) * time.Second)
		}

		fmt.Printf("%s\n", msg)

		// Sleep for another 60 seconds and then re-do the execution
		time.Sleep(time.Duration(60) * time.Second)
	}
}
