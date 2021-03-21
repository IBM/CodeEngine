package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func main() {
	// Pretty print the CE_SERVICES
	services := os.Getenv("CE_SERVICES")
	data := json.RawMessage{}
	json.Unmarshal([]byte(services), &data)
	data, _ = json.MarshalIndent(data, "  ", "  ")
	services = string(data)

	fmt.Printf("Hello from a job - my index is: %s\n", os.Getenv("JOB_INDEX"))
	fmt.Printf("\nAnd my CE_SERVICES is:\n  %s\n", services)
}
