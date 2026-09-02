package api

import "os"

// getEnv reads an environment variable (indirection for tests).
var getEnv = os.Getenv
