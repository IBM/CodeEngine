package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig_Success(t *testing.T) {
	// Create temporary directory structure
	tmpDir := t.TempDir()
	gatewayDir := filepath.Join(tmpDir, "gateway")
	ibmcloudDir := filepath.Join(tmpDir, "ibmcloud")

	if err := os.MkdirAll(gatewayDir, 0755); err != nil {
		t.Fatalf("Failed to create gateway dir: %v", err)
	}
	if err := os.MkdirAll(ibmcloudDir, 0755); err != nil {
		t.Fatalf("Failed to create ibmcloud dir: %v", err)
	}

	// Write test secrets
	testToken := "test-gateway-token-12345"
	testPassword := "test-gateway-password"
	testEncKey := "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=" // base64 of 32-byte key
	testAPIKey := "test-ibm-cloud-api-key"

	if err := os.WriteFile(filepath.Join(gatewayDir, "gateway-token"), []byte(testToken), 0600); err != nil {
		t.Fatalf("Failed to write gateway-token: %v", err)
	}
	if err := os.WriteFile(filepath.Join(gatewayDir, "gateway-password"), []byte(testPassword), 0600); err != nil {
		t.Fatalf("Failed to write gateway-password: %v", err)
	}
	if err := os.WriteFile(filepath.Join(gatewayDir, "encryption-key"), []byte(testEncKey), 0600); err != nil {
		t.Fatalf("Failed to write encryption-key: %v", err)
	}
	if err := os.WriteFile(filepath.Join(ibmcloudDir, "api-key"), []byte(testAPIKey), 0600); err != nil {
		t.Fatalf("Failed to write ibmcloud api-key: %v", err)
	}

	// Set environment variables for configmap values
	os.Setenv("CE_PROJECT_ID", "test-project-id")
	os.Setenv("CE_JOB_NAME", "test-job-name")
	os.Setenv("LOG_LEVEL", "debug")
	os.Unsetenv("LOCAL_MODE") // use file-based (non-local) path
	defer func() {
		os.Unsetenv("CE_PROJECT_ID")
		os.Unsetenv("CE_JOB_NAME")
		os.Unsetenv("LOG_LEVEL")
	}()

	// Override secret paths for testing
	originalReadSecret := readSecret
	readSecret = func(path string) (string, error) {
		// Map test paths to temp directory
		testPath := filepath.Join(tmpDir, filepath.Base(filepath.Dir(path)), filepath.Base(path))
		return originalReadSecret(testPath)
	}
	defer func() { readSecret = originalReadSecret }()

	// Load configuration
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}

	// Verify gateway credentials
	if cfg.GatewayToken != testToken {
		t.Errorf("GatewayToken = %q, want %q", cfg.GatewayToken, testToken)
	}
	if cfg.GatewayPassword != testPassword {
		t.Errorf("GatewayPassword = %q, want %q", cfg.GatewayPassword, testPassword)
	}
	// Encryption key should be exactly 32 bytes after base64 decoding
	if len(cfg.EncryptionKey) != 32 {
		t.Errorf("EncryptionKey length = %d, want 32", len(cfg.EncryptionKey))
	}

	// Verify gateway config
	if cfg.ProjectID != "test-project-id" {
		t.Errorf("ProjectID = %q, want %q", cfg.ProjectID, "test-project-id")
	}
	if cfg.JobName != "test-job-name" {
		t.Errorf("JobName = %q, want %q", cfg.JobName, "test-job-name")
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("LogLevel = %q, want %q", cfg.LogLevel, "debug")
	}
	if cfg.LocalMode {
		t.Errorf("LocalMode = %v, want false (file-based mode)", cfg.LocalMode)
	}

	// Verify IBM Cloud credentials
	if cfg.IBMCloudAPIKey != testAPIKey {
		t.Errorf("IBMCloudAPIKey = %q, want %q", cfg.IBMCloudAPIKey, testAPIKey)
	}
}

func TestLoadConfig_LocalMode(t *testing.T) {
	os.Setenv("LOCAL_MODE", "true")
	os.Setenv("GATEWAY_TOKEN", "local-token")
	os.Setenv("GATEWAY_PASSWORD", "local-password")
	os.Setenv("ENCRYPTION_KEY", "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=")
	os.Setenv("IBMCLOUD_API_KEY", "local-api-key")
	defer func() {
		os.Unsetenv("LOCAL_MODE")
		os.Unsetenv("GATEWAY_TOKEN")
		os.Unsetenv("GATEWAY_PASSWORD")
		os.Unsetenv("ENCRYPTION_KEY")
		os.Unsetenv("IBMCLOUD_API_KEY")
	}()

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}

	if !cfg.LocalMode {
		t.Error("LocalMode = false, want true")
	}
	if cfg.GatewayToken != "local-token" {
		t.Errorf("GatewayToken = %q, want %q", cfg.GatewayToken, "local-token")
	}
	if cfg.GatewayPassword != "local-password" {
		t.Errorf("GatewayPassword = %q, want %q", cfg.GatewayPassword, "local-password")
	}
	if cfg.IBMCloudAPIKey != "local-api-key" {
		t.Errorf("IBMCloudAPIKey = %q, want %q", cfg.IBMCloudAPIKey, "local-api-key")
	}
}

func TestLoadConfig_MissingGatewayToken(t *testing.T) {
	tmpDir := t.TempDir()
	gatewayDir := filepath.Join(tmpDir, "gateway")
	if err := os.MkdirAll(gatewayDir, 0755); err != nil {
		t.Fatalf("Failed to create gateway dir: %v", err)
	}

	// Only write password and encryption key, not token
	if err := os.WriteFile(filepath.Join(gatewayDir, "gateway-password"), []byte("test-password"), 0600); err != nil {
		t.Fatalf("Failed to write gateway-password: %v", err)
	}
	if err := os.WriteFile(filepath.Join(gatewayDir, "encryption-key"), []byte("MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="), 0600); err != nil {
		t.Fatalf("Failed to write encryption-key: %v", err)
	}

	originalReadSecret := readSecret
	readSecret = func(path string) (string, error) {
		testPath := filepath.Join(tmpDir, filepath.Base(filepath.Dir(path)), filepath.Base(path))
		return originalReadSecret(testPath)
	}
	defer func() { readSecret = originalReadSecret }()

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() succeeded, want error for missing gateway token")
	}
	if !contains(err.Error(), "gateway token") {
		t.Errorf("Error message = %q, want to contain 'gateway token'", err.Error())
	}
}

func TestLoadConfig_ShortEncryptionKey(t *testing.T) {
	tmpDir := t.TempDir()
	gatewayDir := filepath.Join(tmpDir, "gateway")
	ibmcloudDir := filepath.Join(tmpDir, "ibmcloud")
	if err := os.MkdirAll(gatewayDir, 0755); err != nil {
		t.Fatalf("Failed to create gateway dir: %v", err)
	}
	if err := os.MkdirAll(ibmcloudDir, 0755); err != nil {
		t.Fatalf("Failed to create ibmcloud dir: %v", err)
	}

	// Write secrets with short encryption key (base64 of 16 bytes)
	if err := os.WriteFile(filepath.Join(gatewayDir, "gateway-token"), []byte("test-token"), 0600); err != nil {
		t.Fatalf("Failed to write gateway-token: %v", err)
	}
	if err := os.WriteFile(filepath.Join(gatewayDir, "gateway-password"), []byte("test-password"), 0600); err != nil {
		t.Fatalf("Failed to write gateway-password: %v", err)
	}
	if err := os.WriteFile(filepath.Join(gatewayDir, "encryption-key"), []byte("MTIzNDU2Nzg5MDEyMzQ1Ng=="), 0600); err != nil {
		t.Fatalf("Failed to write encryption-key: %v", err)
	}
	if err := os.WriteFile(filepath.Join(ibmcloudDir, "api-key"), []byte("test-api-key"), 0600); err != nil {
		t.Fatalf("Failed to write ibmcloud api-key: %v", err)
	}

	originalReadSecret := readSecret
	readSecret = func(path string) (string, error) {
		testPath := filepath.Join(tmpDir, filepath.Base(filepath.Dir(path)), filepath.Base(path))
		return originalReadSecret(testPath)
	}
	defer func() { readSecret = originalReadSecret }()

	_, err := LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() succeeded, want error for short encryption key")
	}
	if !contains(err.Error(), "32 bytes") {
		t.Errorf("Error message = %q, want to contain '32 bytes'", err.Error())
	}
}

func TestReadSecret_Success(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test-secret")
	testContent := "test-secret-value"

	if err := os.WriteFile(testFile, []byte(testContent), 0600); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	result, err := readSecret(testFile)
	if err != nil {
		t.Fatalf("readSecret() failed: %v", err)
	}

	if result != testContent {
		t.Errorf("readSecret() = %q, want %q", result, testContent)
	}
}

func TestReadSecret_WhitespaceTrimming(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test-secret")
	testContent := "  test-secret-value  \n\t"
	expectedContent := "test-secret-value"

	if err := os.WriteFile(testFile, []byte(testContent), 0600); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	result, err := readSecret(testFile)
	if err != nil {
		t.Fatalf("readSecret() failed: %v", err)
	}

	if result != expectedContent {
		t.Errorf("readSecret() = %q, want %q", result, expectedContent)
	}
}

func TestReadSecret_FileNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "nonexistent-secret")

	_, err := readSecret(testFile)
	if err == nil {
		t.Fatal("readSecret() succeeded, want error for nonexistent file")
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
		{
			name:         "environment variable set",
			key:          "TEST_VAR_SET",
			defaultValue: "default",
			envValue:     "custom",
			want:         "custom",
		},
		{
			name:         "environment variable not set",
			key:          "TEST_VAR_UNSET",
			defaultValue: "default",
			envValue:     "",
			want:         "default",
		},
		{
			name:         "environment variable empty string",
			key:          "TEST_VAR_EMPTY",
			defaultValue: "default",
			envValue:     "",
			want:         "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				os.Setenv(tt.key, tt.envValue)
				defer os.Unsetenv(tt.key)
			}

			got := getEnvOrDefault(tt.key, tt.defaultValue)
			if got != tt.want {
				t.Errorf("getEnvOrDefault(%q, %q) = %q, want %q", tt.key, tt.defaultValue, got, tt.want)
			}
		})
	}
}

// Helper function to check if string contains substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || containsMiddle(s, substr)))
}

func containsMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
