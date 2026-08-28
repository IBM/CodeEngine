package config

import (
	"os"
	"testing"
)

const validEncKey = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=" // base64 of 32 bytes

func setEnv(t *testing.T, pairs ...string) {
	t.Helper()
	for i := 0; i < len(pairs); i += 2 {
		t.Setenv(pairs[i], pairs[i+1])
	}
}

func TestLoadConfig_Success(t *testing.T) {
	setEnv(t,
		"GATEWAY_PASSWORD", "test-password",
		"ENCRYPTION_KEY", validEncKey,
		"LOG_LEVEL", "debug",
	)

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}

	if cfg.GatewayPassword != "test-password" {
		t.Errorf("GatewayPassword = %q, want %q", cfg.GatewayPassword, "test-password")
	}
	if len(cfg.EncryptionKey) != 32 {
		t.Errorf("EncryptionKey length = %d, want 32", len(cfg.EncryptionKey))
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("LogLevel = %q, want %q", cfg.LogLevel, "debug")
	}
}

func TestLoadConfig_DefaultLogLevel(t *testing.T) {
	setEnv(t,
		"GATEWAY_PASSWORD", "test-password",
		"ENCRYPTION_KEY", validEncKey,
	)
	os.Unsetenv("LOG_LEVEL")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel = %q, want %q", cfg.LogLevel, "info")
	}
}

func TestLoadConfig_MissingGatewayPassword(t *testing.T) {
	setEnv(t, "ENCRYPTION_KEY", validEncKey)
	os.Unsetenv("GATEWAY_PASSWORD")

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() succeeded, want error for missing GATEWAY_PASSWORD")
	}
	if !contains(err.Error(), "GATEWAY_PASSWORD") {
		t.Errorf("Error = %q, want to contain 'GATEWAY_PASSWORD'", err.Error())
	}
}

func TestLoadConfig_MissingEncryptionKey(t *testing.T) {
	setEnv(t, "GATEWAY_PASSWORD", "test-password")
	os.Unsetenv("ENCRYPTION_KEY")

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() succeeded, want error for missing ENCRYPTION_KEY")
	}
	if !contains(err.Error(), "ENCRYPTION_KEY") {
		t.Errorf("Error = %q, want to contain 'ENCRYPTION_KEY'", err.Error())
	}
}

func TestLoadConfig_ShortEncryptionKey(t *testing.T) {
	setEnv(t,
		"GATEWAY_PASSWORD", "test-password",
		"ENCRYPTION_KEY", "MTIzNDU2Nzg5MDEyMzQ1Ng==", // base64 of 16 bytes
	)

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() succeeded, want error for short ENCRYPTION_KEY")
	}
	if !contains(err.Error(), "32 bytes") {
		t.Errorf("Error = %q, want to contain '32 bytes'", err.Error())
	}
}

func TestGetEnvOrDefault(t *testing.T) {
	tests := []struct {
		name         string
		key          string
		defaultValue string
		envValue     string
		want         string
	}{
		{name: "env set", key: "TEST_VAR_SET", defaultValue: "default", envValue: "custom", want: "custom"},
		{name: "env not set", key: "TEST_VAR_UNSET", defaultValue: "default", envValue: "", want: "default"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				t.Setenv(tt.key, tt.envValue)
			}
			got := getEnvOrDefault(tt.key, tt.defaultValue)
			if got != tt.want {
				t.Errorf("getEnvOrDefault(%q, %q) = %q, want %q", tt.key, tt.defaultValue, got, tt.want)
			}
		})
	}
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
