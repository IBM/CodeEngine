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
		fmt.Printf("%s\n", msg)

		// Just for debugging...
		envs := os.Environ()
		sort.StringSlice(envs).Sort()
		fmt.Printf("Envs:\n%s\n", strings.Join(envs, "\n"))

		// If the 'SLEEP' env var is set then sleep for that many seconds
		sleepDuration := 60
		if t := os.Getenv("SLEEP"); t != "" {
			sleepDuration, _ = strconv.Atoi(t)
		}

		fmt.Printf("Sleeping for %d seconds ...\n", sleepDuration)
		// Per default sleep for 60 seconds and then re-do the execution
		time.Sleep(time.Duration(sleepDuration) * time.Second)
		fmt.Printf("Sleeping [done]\n")
	}
}
