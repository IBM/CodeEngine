package main

import (
	"fmt"
	"runtime/debug"
	"time"
)

// This simple Code Engine job demonstrates how to write unstructured log lines
// using the built-in capabilities of Golang

func main() {

	// expect to be rendered as INFO level log message
	fmt.Println("This is a unstructured log message without a severity identifier")

	// expect to be rendered as WARN level log message
	fmt.Println("This is a unstructured log message with a severity identifier WARN")

	// expect to be rendered as ERROR level log message, without the keyword ERROR being part of the message
	fmt.Println("ERROR This is a unstructured log message prefixed with the level")

	// expect to be rendered as INFO level log message, without the timestamp being part of the message
	fmt.Println(time.Now().UTC().Format("2006-01-02T15:04:05.000Z") + " This is a unstructured log message prefixed with the timestamp")

	// expect to be rendered as DEBUG level log message, without the timestamp and keyword DEBUG being part of the message
	fmt.Println(time.Now().UTC().Format("2006-01-02T15:04:05.000Z") + " DEBUG This is a unstructured log message prefixed with the timestamp and level")

	// Multi-line example. Expect to be rendered in a single log message
	fmt.Println("Multi-line log sample...\\nStep 1: Validating input...\\nStep 2: Processing payment...")

	// Error logging. Expect that the stacktrace is rendered in multiple log statements
	// Note: Use structure logs to support multi-line error stack traces
	func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("Stacktrace example", r)
				fmt.Print(string(debug.Stack()))
			}
		}()
		panic("boom!")
	}()
}
