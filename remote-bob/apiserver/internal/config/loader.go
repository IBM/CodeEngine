package config

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"
)

// AppConfig holds all application configuration loaded from the environment
// and mounted secrets at startup. The API server is single-session and
// stateless: there is no database, so every setting comes from the
// environment or from mounted secret files.
type AppConfig struct {
	GatewayToken    string
	GatewayPassword string
	EncryptionKey   []byte
	ProjectID       string
	Region          string
	JobName         string
	CallbackURL     string // GATEWAY_CALLBACK_URL to pass to job agents
	WSSURL          string // GATEWAY_WSS to pass to job agents
	LogLevel        string
	LocalMode       bool
	IBMCloudAPIKey  string
}

// LoadConfig loads configuration from mounted files and environment variables.
//
// In production (Code Engine) secrets are injected as mounted files under
// /secrets/<name>/<key>.  In local mode (LOCAL_MODE=true) they are read
// directly from environment variables for developer convenience.
func LoadConfig() (*AppConfig, error) {
	cfg := &AppConfig{}

	localMode := getEnvOrDefault("LOCAL_MODE", "false") == "true"
	cfg.LocalMode = localMode

	var token, password, encKeyB64 string
	var err error

	if localMode {
		token = os.Getenv("GATEWAY_TOKEN")
		if token == "" {
			return nil, fmt.Errorf("GATEWAY_TOKEN environment variable not set")
		}
		password = getEnvOrDefault("GATEWAY_PASSWORD", "")
		encKeyB64 = os.Getenv("ENCRYPTION_KEY")
		if encKeyB64 == "" {
			// Default key for local development (not for production use).
			encKeyB64 = "********************************************"
		}
	} else {
		token, err = readSecret("/secrets/gateway/gateway-token")
		if err != nil {
			return nil, fmt.Errorf("failed to load gateway token: %w", err)
		}
		password, err = readSecret("/secrets/gateway/gateway-password")
		if err != nil {
			return nil, fmt.Errorf("failed to load gateway password: %w", err)
		}
		encKeyB64, err = readSecret("/secrets/gateway/encryption-key")
		if err != nil {
			return nil, fmt.Errorf("failed to load encryption key: %w", err)
		}
	}

	cfg.GatewayToken = token
	cfg.GatewayPassword = password

	encKey, err := base64.StdEncoding.DecodeString(encKeyB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encryption key: %w", err)
	}
	if len(encKey) != 32 {
		return nil, fmt.Errorf("encryption key must be exactly 32 bytes for AES-256, got %d bytes", len(encKey))
	}
	cfg.EncryptionKey = encKey

	cfg.ProjectID = os.Getenv("CE_PROJECT_ID")
	cfg.Region = os.Getenv("CE_REGION")
	cfg.JobName = os.Getenv("CE_JOB_NAME")
	cfg.CallbackURL = os.Getenv("GATEWAY_CALLBACK_URL")
	cfg.WSSURL = os.Getenv("GATEWAY_WSS")
	cfg.LogLevel = getEnvOrDefault("LOG_LEVEL", "info")

	var apiKey string
	if localMode {
		apiKey = os.Getenv("IBMCLOUD_API_KEY")
	} else {
		apiKey, err = readSecret("/secrets/ibmcloud/api-key")
		if err != nil {
			return nil, fmt.Errorf("failed to load IBM Cloud API key: %w", err)
		}
	}
	cfg.IBMCloudAPIKey = apiKey

	return cfg, nil
}

// readSecret reads a secret from a mounted file (variable for testing).
var readSecret = func(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
