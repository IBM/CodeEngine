package main

import (
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("Got a connection (ws)\n")

		// Upgrade the HTTP connection to a websocket
		upgrader := websocket.Upgrader{}
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Printf("Upgrade failed: %s", err)
			http.Error(w, "Upgrade failed: "+err.Error(),
				http.StatusInternalServerError)
			return
		}
		defer c.Close()

		for {
			// Read a single message from stream
			messageType, message, err := c.ReadMessage()
			if err != nil {
				fmt.Printf("Read error: %s\n", err)
				break
			}
			fmt.Printf("Server read: %s\n", message)

			// Reverse the string in the message
			l := len(message)
			for i := 0; i < l/2; i++ {
				message[i], message[l-i-1] = message[l-i-1], message[i]
			}

			// And send it back
			if err = c.WriteMessage(messageType, message); err != nil {
				break
			}
		}
	})

	fmt.Printf("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
