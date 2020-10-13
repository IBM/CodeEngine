package main

import (
	"fmt"
	"os"
)

// Just print our INDEX to the log file
func main() {
	fmt.Printf("In the job. My JOB_INDEX is: %s\n", os.Getenv("JOB_INDEX"))
}
