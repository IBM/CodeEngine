package tunnel

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/CodeEngine/remote-bob-job-agent/internal/log"
)

// NewRuntime builds the runtime from a loaded config.
func NewRuntime(cfg *Config) *Runtime {
	adapter := newTTYDAdapter("ws://127.0.0.1:" + cfg.TTYDPort)
	return &Runtime{
		cfg:              cfg,
		state:            &healthState{},
		control:          newControlLoop(cfg, adapter),
		shutdownCh:       make(chan struct{}),
		tmuxPollInterval: 5 * time.Second,
	}
}

// Runtime supervises the tmux session, ttyd process, health server, git
// integration, and the control loop. It owns the startup order
// (tmux → ttyd → control dial) and the graceful shutdown path.
type Runtime struct {
	cfg              *Config
	state            *healthState
	control          *controlLoop
	ttydCmd          *exec.Cmd
	ttydMu           sync.Mutex
	closeOnce        sync.Once
	shutdownCh       chan struct{}
	shutdownErr      error
	// tmuxPollInterval is how often the tmux monitor checks the session.
	// It is a field so tests can shorten it.
	tmuxPollInterval time.Duration
}

// Run starts everything and blocks until shutdown. It returns nil for a
// graceful exit (idle timeout, SIGTERM, tmux death) and an error for a
// startup failure.
func (rt *Runtime) Run(ctx context.Context) error {
	log.Info("job_agent_starting", map[string]interface{}{
		"agent_id":        rt.cfg.AgentID,
		"ttyd_port":       rt.cfg.TTYDPort,
		"health_port":     rt.cfg.HealthPort,
		"workspace":       rt.cfg.Workspace,
		"agent_run_script": rt.cfg.AgentRunScript,
		"idle_timeout":    rt.cfg.IdleTimeout.String(),
	})

	if err := ensureBinary("tmux"); err != nil {
		return err
	}
	if err := ensureBinary("ttyd"); err != nil {
		return err
	}
	if err := ensureExecutable(rt.cfg.AgentRunScript); err != nil {
		return err
	}

	if err := prepareWorkspace(rt.cfg); err != nil {
		return err
	}
	if err := createTmuxSession(rt.cfg); err != nil {
		return err
	}
	rt.state.setTmuxReady(true)
	log.Info("tmux_ready", map[string]interface{}{
		"agent_id": rt.cfg.AgentID,
	})

	childCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 4)
	var wg sync.WaitGroup

	// Health server (127.0.0.1:7081).
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := serveHealth(childCtx, rt.cfg, rt.state); err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, http.ErrServerClosed) {
			select {
			case errCh <- err:
			default:
			}
		}
	}()

	// tmux monitor: if the session dies, mark health unhealthy and keep the
	// health server alive (serving 503) for the bounded grace period so the
	// unhealthy window is observable to liveness probes, then shut down
	// gracefully. The health server is bound to childCtx, so it keeps serving
	// 503 until the grace period elapses.
	tmuxDied := rt.monitorTmux(childCtx)
	wg.Add(1)
	go func() {
		defer wg.Done()
		select {
		case <-tmuxDied:
			select {
			case <-time.After(rt.cfg.TmuxDeathGrace):
			case <-childCtx.Done():
			}
			cancel()
		case <-childCtx.Done():
		}
	}()

	// Start ttyd (127.0.0.1:7080) after tmux is up.
	if err := rt.startTTYD(); err != nil {
		cancel()
		wg.Wait()
		return err
	}
	defer rt.stopTTYD()

	// Wait for ttyd to accept connections before dialing the control
	// connection (startup order tmux → ttyd → control dial).
	if err := waitForTTYD(childCtx, "ws://127.0.0.1:"+rt.cfg.TTYDPort, rt.cfg.TTYDReadyTimeout); err != nil {
		cancel()
		wg.Wait()
		return err
	}
	log.Info("ttyd_ready", map[string]interface{}{
		"addr": "127.0.0.1:" + rt.cfg.TTYDPort,
	})

	// Control loop: dial, register, handle relays, reconnect with backoff.
	wg.Add(1)
	go func() {
		defer wg.Done()
		err := rt.control.run(childCtx)
		if errors.Is(err, errTerminated) {
			// The apiserver deliberately terminated this agent (End Session /
			// DELETE /agents/{id}). Trigger graceful shutdown; this is not an
			// error condition.
			log.Info("agent_terminated_by_server_shutdown", map[string]interface{}{
				"agent_id": rt.cfg.AgentID,
			})
			cancel()
			return
		}
		if err != nil && !errors.Is(err, context.Canceled) {
			select {
			case errCh <- err:
			default:
			}
		}
	}()

	// Idle timeout: exit gracefully when no active relays for the timeout.
	idleDone := rt.control.idleTimeout(childCtx)

	select {
	case <-childCtx.Done():
		// SIGTERM/SIGINT, tmux death, or a fatal error.
	case <-idleDone:
		log.Info("idle_timeout_shutdown", map[string]interface{}{
			"agent_id": rt.cfg.AgentID,
		})
	case err := <-errCh:
		rt.shutdownErr = err
		cancel()
	}

	// Graceful shutdown: close relays, finalize git, stop ttyd/tmux.
	rt.shutdown()
	wg.Wait()
	return rt.shutdownErr
}

// shutdown performs the graceful shutdown sequence exactly once.
func (rt *Runtime) shutdown() {
	rt.closeOnce.Do(func() {
		log.Info("graceful_shutdown_start", map[string]interface{}{
			"agent_id": rt.cfg.AgentID,
		})
		// Close active relays so browsers see a clean close.
		rt.control.closeAllRelays()
		rt.stopTTYD()
		killTmuxSession(rt.cfg.AgentID)
		close(rt.shutdownCh)
		log.Info("graceful_shutdown_complete", map[string]interface{}{
			"agent_id": rt.cfg.AgentID,
		})
	})
}

// tmuxSocket returns the explicit tmux server socket path for this agent.
// Using a fixed path prevents socket-divergence when tmux is created by one
// process and attached by ttyd (a child that may inherit a different TMPDIR).
func tmuxSocket(agentID string) string {
	return "/tmp/tmux-bob-" + agentID
}

// createTmuxSession starts a detached tmux session that runs the agent preset's
// run script (/usr/local/bin/agent-run.sh). The script is installed into the
// image at build time by the chosen agent preset's run.sh.
// All environment variables injected by Code Engine (including any agent API
// keys from the CE secret) are available inside the tmux session because tmux
// inherits the process environment.
func createTmuxSession(cfg *Config) error {
	socket := tmuxSocket(cfg.AgentID)
	if err := runCommand("tmux", []string{
		"-S", socket,
		"new-session", "-d", "-s", cfg.AgentID,
		"-c", cfg.Workspace,
		"-e", "TERM=xterm-256color",
		"-e", "LANG=" + cfg.Lang,
		"-e", "LC_ALL=" + cfg.LCAll,
		"bash", "-lc", cfg.AgentRunScript,
	}, ""); err != nil {
		return err
	}
	time.Sleep(3 * time.Second)
	if err := runCommand("tmux", []string{"-S", socket, "has-session", "-t", cfg.AgentID}, ""); err != nil {
		return fmt.Errorf("failed to create tmux session: %w", err)
	}
	return nil
}

// startTTYD launches ttyd bound to 127.0.0.1 only.
// SysProcAttr.Setsid gives ttyd its own process session so tcsetpgrp()
// works correctly when tmux attach-session is the PTY child.
func (rt *Runtime) startTTYD() error {
	socket := tmuxSocket(rt.cfg.AgentID)
	cmd := exec.Command("ttyd", "--port", rt.cfg.TTYDPort, "--interface", "127.0.0.1", "--writable", "--max-clients", "10", "tmux", "-S", socket, "attach-session", "-t", rt.cfg.AgentID)
	cmd.Env = append(os.Environ(), "TMUX_TMPDIR=/tmp")
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return err
	}
	rt.ttydMu.Lock()
	rt.ttydCmd = cmd
	rt.ttydMu.Unlock()
	go func() {
		_ = cmd.Wait()
	}()
	log.Info("ttyd_started", map[string]interface{}{
		"addr": "127.0.0.1:" + rt.cfg.TTYDPort,
	})
	return nil
}

// stopTTYD terminates the ttyd process.
func (rt *Runtime) stopTTYD() {
	rt.ttydMu.Lock()
	cmd := rt.ttydCmd
	rt.ttydMu.Unlock()
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
		_, _ = cmd.Process.Wait()
	}
}

// monitorTmux polls the tmux session; when it dies, health flips to
// unhealthy and the returned channel is closed. The caller decides when to
// proceed with shutdown (after the bounded grace period), so the health
// server keeps serving 503 during that window.
func (rt *Runtime) monitorTmux(ctx context.Context) <-chan struct{} {
	died := make(chan struct{})
	go func() {
		ticker := time.NewTicker(rt.tmuxPollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := exec.Command("tmux", "-S", tmuxSocket(rt.cfg.AgentID), "has-session", "-t", rt.cfg.AgentID).Run(); err != nil {
					rt.state.setTmuxReady(false)
					log.Info("tmux_session_died", map[string]interface{}{
						"agent_id": rt.cfg.AgentID,
					})
					close(died)
					return
				}
			}
		}
	}()
	return died
}

// killTmuxSession kills the tmux session (best effort).
func killTmuxSession(session string) {
	_ = exec.Command("tmux", "-S", tmuxSocket(session), "kill-session", "-t", session).Run()
}

// ensureExecutable checks that the given file exists and is executable.
func ensureExecutable(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("agent run script not found at %s: %w", path, err)
	}
	if info.Mode()&0111 == 0 {
		return fmt.Errorf("agent run script at %s is not executable", path)
	}
	return nil
}

func logVersion(name string, args ...string) {
	cmd := exec.Command(name, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Warn("binary_version_failed", map[string]interface{}{
			"name":  name,
			"error": err.Error(),
		})
		return
	}
	log.Info("binary_version", map[string]interface{}{
		"name":    name,
		"version": string(output),
	})
}
