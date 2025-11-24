package main

import (
    "fmt"
    "net/http"
    "time"
)

func greet(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello World! %s", time.Now())
}

func main() {
    http.HandleFunc("/", greet)
    http.ListenAndServe(":3000", nil)
}