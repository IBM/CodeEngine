package config

import (
	"encoding/base64"
	"fmt"
	"os"
)

// AppConfig holds all application configuration loaded from the environment.
// Secrets are injected as environment variables via --env-from-secret in both
// local mode and production (Code Engine).
type AppConfig struct {
	GatewayPassword string
	EncryptionKey   []byte
	LogLevel        string
}

// LoadConfig loads configuration from environment variables. In production
// (Code Engine) secrets are injected by --env-from-secret; in local mode they
// are set directly in the environment.
func LoadConfig() (*AppConfig, error) {
	cfg := &AppConfig{}

	password := os.Getenv("GATEWAY_PASSWORD")
	if password == "" {
		return nil, fmt.Errorf("GATEWAY_PASSWORD is required")
	}
	cfg.GatewayPassword = password

	encKeyB64 := os.Getenv("ENCRYPTION_KEY")
	if encKeyB64 == "" {
		return nil, fmt.Errorf("ENCRYPTION_KEY is required")
	}
	encKey, err := base64.StdEncoding.DecodeString(encKeyB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ENCRYPTION_KEY: %w", err)
	}
	if len(encKey) != 32 {
		return nil, fmt.Errorf("ENCRYPTION_KEY must be exactly 32 bytes, got %d bytes", len(encKey))
	}
	cfg.EncryptionKey = encKey

	cfg.LogLevel = getEnvOrDefault("LOG_LEVEL", "info")

	return cfg, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
