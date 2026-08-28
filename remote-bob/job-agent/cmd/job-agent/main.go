package main

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"

	"github.ibm.com/JORDANJ/remote-bob-common/log"
	"github.ibm.com/JORDANJ/remote-bob/job-agent/internal/tunnel"
)

func main() {
	cfg, err := tunnel.LoadConfig()
	if err != nil {
		log.Error("job_agent_config_failed", err)
		os.Exit(1)
	}

	rt := tunnel.NewRuntime(cfg)
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if err := rt.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Error("job_agent_failed", err, "agent_id", cfg.AgentID)
		os.Exit(1)
	}
}
