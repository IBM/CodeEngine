package main

import (
	"fmt"
	"os"
)

// Just print our greeting to the log file
func main() {
	fmt.Printf("In the job. Env var FOO: '%s' Received greeting: %s\n", os.Getenv("FOO"), os.Getenv("greeting"))
}
