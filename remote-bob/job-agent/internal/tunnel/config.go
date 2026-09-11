package tunnel

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultTTYDPort       = "7080"
	defaultHealthPort     = "7081"
	defaultWorkspace      = "/workspace"
	defaultBobMode        = "interactive"
	defaultIdleTimeout    = 5 * time.Minute
	defaultReconnectDelay = 2 * time.Second
	defaultTTYDReadyWait  = 30 * time.Second
	defaultTmuxDeathGrace = 5 * time.Second
	defaultRunTokenFile   = "/secrets/run-token"
)

// runTokenSecretPath is a package variable so tests can redirect it to a
// temporary file.
var runTokenSecretPath = defaultRunTokenFile

// Config holds the job-agent tunnel daemon configuration, loaded from the
// environment and mounted secret files.
type Config struct {
	AgentID        string
	RunToken       string
	GatewayWSS     string
	TTYDPort       string
	HealthPort     string
	Workspace      string
	BobMode        string
	BobShellAPIKey string
	// BobApprovalMode overrides the approvalMode field in settings.json when
	// non-empty. Loaded from BOB_APPROVAL_MODE env var.
	BobApprovalMode string
	// BobTelemetrySet is true when BOB_TELEMETRY_ENABLED is present in the env.
	BobTelemetrySet     bool
	BobTelemetryEnabled bool
	Lang               string
	LCAll              string
	IdleTimeout        time.Duration
	ReconnectDelay     time.Duration
	TTYDReadyTimeout   time.Duration
	// TmuxDeathGrace is how long the health server keeps serving 503
	// {"status":"unhealthy"} after the tmux session dies, before the
	// graceful shutdown sequence proceeds.
	TmuxDeathGrace time.Duration
}

// LoadConfig reads configuration from the environment and mounted secret
// files. Required values (AGENT_ID, RUN_TOKEN, GATEWAY_WSS) fail fast with a
// descriptive error naming the missing variable.
func LoadConfig() (*Config, error) {
	cfg := &Config{
		AgentID:         os.Getenv("AGENT_ID"),
		RunToken:        os.Getenv("RUN_TOKEN"),
		GatewayWSS:      os.Getenv("GATEWAY_WSS"),
		TTYDPort:        getenv("TTYD_PORT", defaultTTYDPort),
		HealthPort:      getenv("HEALTH_PORT", defaultHealthPort),
		Workspace:       getenv("WORKSPACE", defaultWorkspace),
		BobMode:         getenv("BOB_MODE", defaultBobMode),
		BobApprovalMode: os.Getenv("BOB_APPROVAL_MODE"),
		Lang:            getenv("LANG", "en_US.UTF-8"),
		LCAll:           getenv("LC_ALL", "en_US.UTF-8"),
		IdleTimeout:     durationFromEnv("IDLE_TIMEOUT_MS", defaultIdleTimeout),
		ReconnectDelay:  durationFromEnv("RECONNECT_DELAY_MS", defaultReconnectDelay),
		TTYDReadyTimeout: durationFromEnv("TTYD_READY_TIMEOUT_MS", defaultTTYDReadyWait),
		TmuxDeathGrace:  durationFromEnv("TMUX_DEATH_GRACE_MS", defaultTmuxDeathGrace),
	}

	if telRaw := os.Getenv("BOB_TELEMETRY_ENABLED"); telRaw != "" {
		cfg.BobTelemetrySet = true
		cfg.BobTelemetryEnabled = telRaw == "true" || telRaw == "1"
	}

	if cfg.AgentID == "" {
		return nil, fmt.Errorf("AGENT_ID is required")
	}
	if cfg.RunToken == "" {
		// Fall back to the mounted secret file.
		if token, err := readSecretFile(runTokenSecretPath); err == nil && token != "" {
			cfg.RunToken = token
		} else {
			return nil, fmt.Errorf("RUN_TOKEN is required (set RUN_TOKEN or mount it at %s)", runTokenSecretPath)
		}
	}
	if cfg.GatewayWSS == "" {
		return nil, fmt.Errorf("GATEWAY_WSS is required")
	}

	switch cfg.BobMode {
	case "interactive", "plan", "auto":
	default:
		return nil, fmt.Errorf("invalid BOB_MODE %q: must be one of interactive, plan, auto", cfg.BobMode)
	}

	apiKey := os.Getenv("BOBSHELL_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("BOBSHELL_API_KEY is required")
	}
	cfg.BobShellAPIKey = apiKey

	return cfg, nil
}

// readSecretFile reads and trims a mounted secret file.
func readSecretFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// bobCommand returns the tmux pane command for the configured BOB_MODE.
func bobCommand(cfg *Config) string {
	switch cfg.BobMode {
	case "plan":
		return "bob chat --auto-approve --trust --accept-license --mode autonomous-loop-planner"
	case "auto":
		return "bob chat --auto-approve --trust --accept-license --mode auto"
	default:
		return "bob chat --auto-approve --trust --accept-license"
	}
}

// controlURL builds the agent control WS URL: GATEWAY_WSS/ws/agent?agent=<ID>.
// The run token is never placed in the URL — it travels in the Authorization header.
func controlURL(gatewayWSS, agentID string) string {
	base := strings.TrimSuffix(gatewayWSS, "/")
	base = strings.TrimSuffix(base, "/ws")
	return base + "/ws/agent?agent=" + url.QueryEscape(agentID)
}

// relayURL builds the agent relay WS URL: GATEWAY_WSS/ws/relay?relayToken=<t>.
func relayURL(gatewayWSS, relayToken string) string {
	base := strings.TrimSuffix(gatewayWSS, "/")
	base = strings.TrimSuffix(base, "/ws")
	return base + "/ws/relay?relayToken=" + url.QueryEscape(relayToken)
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func durationFromEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value + "ms")
	if err != nil {
		return fallback
	}
	return parsed
}
