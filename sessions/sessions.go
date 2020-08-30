package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-redis/redis"
)

var IP = os.Getenv("IP")
var client = NewClient()
var ctx = context.Background()

func NewClient() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     IP + ":6379", // "localhost:6379",
		Password: "",
		DB:       0,
	})
}

func Lock() {
	fmt.Printf("Waiting for lock\n")
	for {
		b, err := client.SetNX(ctx, "lock", "lock", time.Second*10).Result()
		fmt.Printf("b,err = %v, %v\n", b, err)
		if b {
			break
		}
		time.Sleep(time.Second)
	}
	fmt.Printf("Got it\n")
}

func Unlock() {
	fmt.Printf("Unlocking\n")
	client.Del(ctx, "lock")
	fmt.Printf("Unlocked\n")
}

func Handler(w http.ResponseWriter, r *http.Request) {
	Lock()
	count, err := client.Get(ctx, "count").Int()
	if err != nil && err.Error() != "redis: nil" {
		fmt.Fprintf(w, "Err: %v\n", err)
	}
	count = count + 1
	client.Set(ctx, "count", count, 0)
	Unlock()

	fmt.Fprintf(w, "Counter: %v  ", count)
	fmt.Fprintf(w, "Hostname: %s\n", os.Getenv("HOSTNAME"))

	time.Sleep(250 * time.Millisecond)
}

func main() {
	http.HandleFunc("/", Handler)
	http.ListenAndServe(":8080", nil)
}
