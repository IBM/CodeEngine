package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/api"
	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/config"
	"github.ibm.com/JORDANJ/remote-bob/apiserver/internal/log"
)

func main() {
	// Load the single configuration from environment and mounted secrets.
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Error("failed_to_load_config", err)
		os.Exit(1)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Info("apiserver_starting", map[string]interface{}{
		"port":       port,
		"local_mode": cfg.LocalMode,
		"log_level":  cfg.LogLevel,
	})

	// Create the server. The run token signing key is the ENCRYPTION_KEY so
	// that stateless run tokens survive apiserver restarts.
	srv := api.NewServer(api.Config{
		GatewayPassword: cfg.GatewayPassword,
		RunTokenKey:     cfg.EncryptionKey,
	})

	// Once the last agent disconnects (job succeeded/exited, idle timeout,
	// or End Session), the apiserver should exit so that the container stops
	// (releasing resources and port bindings) or Code Engine scales the app
	// to zero.
	//
	// MarkShuttingDown is called from the onEmpty callback; it closes
	// srv.ShutdownCh() which main selects on below. This is deliberately NOT
	// done via SIGTERM because httpServer.Shutdown does not wait for hijacked
	// (WebSocket) connections to close — if we sent SIGTERM the process could
	// exit before the 4001 close frame reached the job-agent, leaving the job
	// running indefinitely.
	srv.AgentRegistry().SetOnEmpty(func() {
		log.Info("last_agent_disconnected_shutting_down", nil)
		srv.MarkShuttingDown()
	})

	// Setup HTTP routes.
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	// Middleware chain: request logging (redacted) -> CORS -> panic recovery.
	handler := api.NewRequestLogger(mux)
	handler = api.NewCORSMiddleware().Wrap(handler)
	handler = api.NewPanicRecovery(handler)

	// Create HTTP server.
	// NOTE: ReadTimeout and WriteTimeout are intentionally omitted.
	// Setting either on an http.Server that serves WebSocket connections causes
	// the underlying TCP connection to be killed after the timeout fires.
	// WS connections are long-lived; per-message deadlines are set inside the
	// WS handlers instead.
	httpServer := &http.Server{
		Addr:        ":" + port,
		Handler:     handler,
		IdleTimeout: 120 * time.Second,
	}

	// Start server in a goroutine.
	go func() {
		log.Info("gateway_listening", map[string]interface{}{
			"addr": httpServer.Addr,
		})
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server_error", err)
			os.Exit(1)
		}
	}()

	// Wait for an OS signal or for the server to signal shutdown itself
	// (last agent disconnected). Using srv.ShutdownCh() rather than SIGTERM
	// ensures the process stays alive long enough for in-flight 4001 close
	// frames to reach job-agents before httpServer.Shutdown runs.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-quit:
	case <-srv.ShutdownCh():
		// All agents have disconnected. Wait for every handleAgentWS goroutine
		// to finish flushing its 4001 close frame before stopping the server.
		// httpServer.Shutdown does not wait for hijacked (WebSocket) connections,
		// so without this wait the job-agent would never receive 4001 and would
		// keep its CE job running until the max-execution timeout.
		srv.WaitAgentsDone()
	}

	log.Info("gateway_shutting_down", nil)

	// Graceful shutdown with timeout.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Error("shutdown_error", err)
	}

	srv.Shutdown()

	log.Info("gateway_stopped", nil)
}
