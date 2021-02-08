package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Missing URL\n")
		os.Exit(1)
	}

	url := os.Args[1]

	// Make sure the URL is a websocket URL
	if !strings.HasPrefix(url, "ws://") && !strings.HasPrefix(url, "wss://") {
		fmt.Printf("URL (%s) must be ws://... or wss:/...", url)
		os.Exit(1)
	}

	// Establish the websocket connection
	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		fmt.Printf("Error connecting to %s: %s\n", url, err)
		os.Exit(1)
	}
	defer c.Close()

	// The string we'll send, and what we expect to get back.
	// The server should just reverse the string.
	buf := []byte("1234567890")
	expected := "0987654321"

	// How many messages we'll send and receive
	tries := 10

	go func() {
		// Loop until we get all "tried" number of messages from server
		for count := 0; count < tries; count++ {
			if _, message, err := c.ReadMessage(); err != nil {
				fmt.Printf("Read error: %s\n", err)
				os.Exit(1)
			} else if string(message) != expected {
				fmt.Printf("Unexpected output: %q\n", message)
				os.Exit(1)
			} else {
				fmt.Printf("Client read: %q\n", message)
			}
		}
	}()

	// Send "tries" number of messages to the server
	for i := 0; i < tries; i++ {
		if err := c.WriteMessage(websocket.TextMessage, buf); err != nil {
			fmt.Printf("Write error: %s\n", err)
			os.Exit(1)
		}
		fmt.Printf("Client write: %q\n", string(buf))
		time.Sleep(2 * time.Second) // wait to read response
	}
}
