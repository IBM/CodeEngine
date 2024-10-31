package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var IP = os.Getenv("IP")
var client = NewClient()

func NewClient() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     IP + ":6379", // "localhost:6379",
		Password: "",
		DB:       0,
	})
}

var ctx = context.Background()

func Handler(w http.ResponseWriter, r *http.Request) {
	count, err := client.Incr(ctx, "count").Result()
	if err != nil {
		fmt.Fprintf(w, "Err: %v\n", err)
	}

	fmt.Fprintf(w, "Counter: %v  ", count)
	fmt.Fprintf(w, "Hostname: %s\n", os.Getenv("HOSTNAME"))

	time.Sleep(250 * time.Millisecond)
}

func main() {
	http.HandleFunc("/", Handler)
	http.ListenAndServe(":8080", nil)
}
