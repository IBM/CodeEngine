package main

import (
	"fmt"
	"os"
)

func main() {
	event := os.Getenv("CE_DATA")
	fmt.Printf("Event: %s\n", event)

	// Do real business logic here...
}
