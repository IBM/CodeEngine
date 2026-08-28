package tunnel

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestPatchBobSettings_NothingToOverride(t *testing.T) {
	// When both BobApprovalMode is empty and BobTelemetrySet is false,
	// patchBobSettings should be a no-op (no file written).
	cfg := &Config{}
	tmp := t.TempDir()
	settingsPath := filepath.Join(tmp, ".bob", "settings", "settings.json")

	// Override home directory — patchBobSettings uses os.UserHomeDir().
	// We can't easily override that, so verify the function returns nil
	// without creating any file.
	if err := patchBobSettings(cfg); err != nil {
		t.Fatalf("expected no-op, got error: %v", err)
	}
	// The real home dir may or may not have a settings file; just check
	// the no-op path returns without error.
	_ = settingsPath
}

func TestPatchBobSettings_ApprovalModeAndTelemetry(t *testing.T) {
	// Write a minimal settings.json, then patch it.
	tmp := t.TempDir()
	dir := filepath.Join(tmp, ".bob", "settings")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	settingsFile := filepath.Join(dir, "settings.json")
	initial := map[string]interface{}{
		"approvalMode": "manual",
		"telemetry":    map[string]interface{}{"enabled": true},
		"other":        "preserved",
	}
	initialData, _ := json.Marshal(initial)
	if err := os.WriteFile(settingsFile, initialData, 0o644); err != nil {
		t.Fatal(err)
	}

	// Point patchBobSettings at our temp dir by overriding HOME.
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", tmp)

	cfg := &Config{
		BobApprovalMode:     "auto_approve",
		BobTelemetrySet:     true,
		BobTelemetryEnabled: false,
	}
	if err := patchBobSettings(cfg); err != nil {
		t.Fatalf("patchBobSettings: %v", err)
	}

	data, err := os.ReadFile(settingsFile)
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]interface{}
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("parse patched settings: %v", err)
	}

	if got["approvalMode"] != "auto_approve" {
		t.Errorf("approvalMode = %v, want auto_approve", got["approvalMode"])
	}
	tel, ok := got["telemetry"].(map[string]interface{})
	if !ok {
		t.Fatalf("telemetry not a map: %v", got["telemetry"])
	}
	if tel["enabled"] != false {
		t.Errorf("telemetry.enabled = %v, want false", tel["enabled"])
	}
	// Existing keys must be preserved.
	if got["other"] != "preserved" {
		t.Errorf("other field dropped: %v", got["other"])
	}
}

func TestPatchBobSettings_MissingFile(t *testing.T) {
	// If settings.json does not exist, patchBobSettings should create it.
	tmp := t.TempDir()
	dir := filepath.Join(tmp, ".bob", "settings")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}

	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", tmp)

	cfg := &Config{
		BobApprovalMode: "auto_approve",
	}
	if err := patchBobSettings(cfg); err != nil {
		t.Fatalf("patchBobSettings with missing file: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(dir, "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]interface{}
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	if got["approvalMode"] != "auto_approve" {
		t.Errorf("approvalMode = %v, want auto_approve", got["approvalMode"])
	}
}

func TestLoadConfig_BobApprovalModeAndTelemetry(t *testing.T) {
	// Minimal required env to make LoadConfig succeed.
	for k, v := range map[string]string{
		"AGENT_ID":              "test-agent",
		"RUN_TOKEN":             "test-token",
		"GATEWAY_WSS":           "wss://api.example.com",
		"BOBSHELL_API_KEY":      "test-api-key",
		"BOB_APPROVAL_MODE":     "manual",
		"BOB_TELEMETRY_ENABLED": "false",
	} {
		t.Setenv(k, v)
	}

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.BobApprovalMode != "manual" {
		t.Errorf("BobApprovalMode = %q, want manual", cfg.BobApprovalMode)
	}
	if !cfg.BobTelemetrySet {
		t.Error("BobTelemetrySet should be true when BOB_TELEMETRY_ENABLED is set")
	}
	if cfg.BobTelemetryEnabled {
		t.Error("BobTelemetryEnabled should be false for 'false'")
	}
}

func TestLoadConfig_BobTelemetryTrueValues(t *testing.T) {
	for _, val := range []string{"true", "1"} {
		t.Run(val, func(t *testing.T) {
			for k, v := range map[string]string{
				"AGENT_ID":              "test-agent",
				"RUN_TOKEN":             "test-token",
				"GATEWAY_WSS":           "wss://api.example.com",
				"BOBSHELL_API_KEY":      "test-api-key",
				"BOB_TELEMETRY_ENABLED": val,
			} {
				t.Setenv(k, v)
			}
			cfg, err := LoadConfig()
			if err != nil {
				t.Fatalf("LoadConfig: %v", err)
			}
			if !cfg.BobTelemetryEnabled {
				t.Errorf("BobTelemetryEnabled should be true for %q", val)
			}
		})
	}
}
