package tunnel

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// setConfigEnv sets the minimal valid env for LoadConfig.
// Tests that want to exercise a missing variable unset it after calling this.
func setConfigEnv(t *testing.T) {
	t.Helper()
	t.Setenv("AGENT_ID", "agent-1")
	t.Setenv("RUN_TOKEN", "run-token-123")
	t.Setenv("GATEWAY_WSS", "ws://gateway:8080/ws")
	t.Setenv("BOBSHELL_API_KEY", "bob-key")
	runTokenSecretPath = "/nonexistent/run-token"
}

func TestLoadConfig_MissingAgentID(t *testing.T) {
	setConfigEnv(t)
	t.Setenv("AGENT_ID", "")
	_, err := LoadConfig()
	if err == nil || !strings.Contains(err.Error(), "AGENT_ID") {
		t.Fatalf("LoadConfig() error = %v, want error naming AGENT_ID", err)
	}
}

func TestLoadConfig_MissingRunToken(t *testing.T) {
	setConfigEnv(t)
	t.Setenv("RUN_TOKEN", "")
	_, err := LoadConfig()
	if err == nil || !strings.Contains(err.Error(), "RUN_TOKEN") {
		t.Fatalf("LoadConfig() error = %v, want error naming RUN_TOKEN", err)
	}
}

func TestLoadConfig_MissingGatewayWSS(t *testing.T) {
	setConfigEnv(t)
	t.Setenv("GATEWAY_WSS", "")
	_, err := LoadConfig()
	if err == nil || !strings.Contains(err.Error(), "GATEWAY_WSS") {
		t.Fatalf("LoadConfig() error = %v, want error naming GATEWAY_WSS", err)
	}
}

func TestLoadConfig_Defaults(t *testing.T) {
	setConfigEnv(t)
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}
	if cfg.TTYDPort != "7080" {
		t.Errorf("TTYDPort = %q, want 7080", cfg.TTYDPort)
	}
	if cfg.HealthPort != "7081" {
		t.Errorf("HealthPort = %q, want 7081", cfg.HealthPort)
	}
	if cfg.Workspace != "/workspace" {
		t.Errorf("Workspace = %q, want /workspace", cfg.Workspace)
	}
	if cfg.BobMode != "interactive" {
		t.Errorf("BobMode = %q, want interactive", cfg.BobMode)
	}
	if cfg.IdleTimeout != 5*time.Minute {
		t.Errorf("IdleTimeout = %v, want 5m", cfg.IdleTimeout)
	}
	if cfg.TmuxDeathGrace != 5*time.Second {
		t.Errorf("TmuxDeathGrace = %v, want 5s", cfg.TmuxDeathGrace)
	}
}

func TestLoadConfig_RunTokenFromSecretFile(t *testing.T) {
	setConfigEnv(t)
	t.Setenv("RUN_TOKEN", "")
	dir := t.TempDir()
	secretPath := filepath.Join(dir, "run-token")
	if err := os.WriteFile(secretPath, []byte("  secret-from-file\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	runTokenSecretPath = secretPath
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}
	if cfg.RunToken != "secret-from-file" {
		t.Errorf("RunToken = %q, want secret-from-file (trimmed)", cfg.RunToken)
	}
}

func TestLoadConfig_InvalidBobMode(t *testing.T) {
	setConfigEnv(t)
	t.Setenv("BOB_MODE", "bogus")
	_, err := LoadConfig()
	if err == nil || !strings.Contains(err.Error(), "BOB_MODE") {
		t.Fatalf("LoadConfig() error = %v, want error naming BOB_MODE", err)
	}
}

func TestLoadConfig_IdleTimeoutConfigurable(t *testing.T) {
	setConfigEnv(t)
	t.Setenv("IDLE_TIMEOUT_MS", "1500")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}
	if cfg.IdleTimeout != 1500*time.Millisecond {
		t.Errorf("IdleTimeout = %v, want 1.5s", cfg.IdleTimeout)
	}
}

func TestLoadConfig_TmuxDeathGraceConfigurable(t *testing.T) {
	setConfigEnv(t)
	t.Setenv("TMUX_DEATH_GRACE_MS", "2000")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() failed: %v", err)
	}
	if cfg.TmuxDeathGrace != 2*time.Second {
		t.Errorf("TmuxDeathGrace = %v, want 2s", cfg.TmuxDeathGrace)
	}
}

func TestBobCommandVariants(t *testing.T) {
	cfg := &Config{BobMode: "interactive"}
	interactive := bobCommand(cfg)
	cfg.BobMode = "plan"
	plan := bobCommand(cfg)
	cfg.BobMode = "auto"
	auto := bobCommand(cfg)

	if interactive == plan || plan == auto || interactive == auto {
		t.Errorf("BOB_MODE variants must produce different tmux commands: interactive=%q plan=%q auto=%q", interactive, plan, auto)
	}
	if !strings.Contains(interactive, "bob chat --auto-approve --trust --accept-license") {
		t.Errorf("interactive command = %q, want bob chat --auto-approve --trust --accept-license", interactive)
	}
	if !strings.Contains(plan, "autonomous-loop-planner") {
		t.Errorf("plan command = %q, want autonomous-loop-planner mode", plan)
	}
}

func TestControlURL(t *testing.T) {
	// GATEWAY_WSS ending in /ws
	if got := controlURL("ws://gateway:8080/ws", "agent-1"); got != "ws://gateway:8080/ws/agent?agent=agent-1" {
		t.Errorf("controlURL(/ws) = %q", got)
	}
	// GATEWAY_WSS without /ws suffix
	if got := controlURL("wss://gateway.example.com", "agent-1"); got != "wss://gateway.example.com/ws/agent?agent=agent-1" {
		t.Errorf("controlURL(no /ws) = %q", got)
	}
	// agent id is URL-escaped
	if got := controlURL("ws://g/ws", "a b"); !strings.Contains(got, "agent=a+b") {
		t.Errorf("controlURL escaping = %q", got)
	}
}

func TestRelayURL(t *testing.T) {
	if got := relayURL("ws://gateway:8080/ws", "tok-1"); got != "ws://gateway:8080/ws/relay?relayToken=tok-1" {
		t.Errorf("relayURL = %q", got)
	}
}
