package main

import (
	"log"
	"os"
)

// mustEnv returns the value of an environment variable and exits if it is not set.
func mustEnv(name string) string {
	v := os.Getenv(name)
	if v == "" {
		log.Fatalf("environment variable %s is required", name)
	}
	return v
}

// getEnv returns the value of an environment variable, or the fallback if it is not set.
func getEnv(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
