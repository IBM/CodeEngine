# Remote Bob Job Agent

Browser-based terminal access to Bob Shell running on IBM Code Engine.

## Architecture (v4 — Go tunnel daemon)

```
Browser (xterm.js)
    ↕ WS /ws/browser (ttyd binary protocol)
apiserver (auth + opaque relay + agent registry)
    ↕ control WS /ws/agent (Bearer run token) + relay WS /ws/relay
Job Agent container (Go tunnel daemon)
    ├── control loop   — dials /ws/agent, registers services, handles relay-open/relay-close
    ├── ttyd adapter   — ttyd 1.7.7 binary JSON handshake, first-frame resize forwarding
    ├── ttyd           — terminal over WebSocket, 127.0.0.1:7080 (loopback only)
    ├── health server  — 127.0.0.1:7081 (200 only when tmux is ready)
    └── tmux session   — running `bob chat --auto-approve --trust --accept-license`
```

The job agent is a **single Go binary** (`cmd/job-agent/main.go` + `internal/tunnel/`).
It keeps tmux + ttyd + health + git integration + Bob Shell config seeding, and
replaces the legacy Node/bash bridge (`ws-bridge.js` / `start-tmux-bob.sh`,
deleted) with a generic tunnel daemon that authenticates to the apiserver with
a per-run token and forwards frames opaquely.

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile` | debian:bookworm-slim + tmux + ttyd + gh + Bob Shell 2.0.1 (pinned tarball build arg) |
| `cmd/job-agent/main.go` | Entrypoint: load config, run the tunnel daemon |
| `internal/tunnel/config.go` | Env/secret config loading + validation |
| `internal/tunnel/control.go` | Control loop: dial, register, relay handling, reconnect with backoff, idle timeout |
| `internal/tunnel/ttyd_adapter.go` | ttyd 1.7.7 handshake + first-frame resize forwarding |
| `internal/tunnel/runtime.go` | tmux/ttyd supervision, startup order, graceful shutdown |
| `internal/tunnel/git.go` | Optional git clone/checkout + commit/push on shutdown |
| `internal/tunnel/health.go` | Health server (127.0.0.1:7081) |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_ID` | Yes | — | Agent identifier (replaces `SESSION_ID`) |
| `RUN_TOKEN` | Yes | — | Per-run token; env var or mounted at `/secrets/run-token` |
| `GATEWAY_WSS` | Yes | — | Apiserver WS base URL (e.g. `wss://host/ws`) |
| `BOBSHELL_API_KEY` | Yes* | — | Bob Shell API key — mount at `/secrets/bobshell/api-key` |
| `TTYD_PORT` | No | `7080` | ttyd port (binds to 127.0.0.1) |
| `HEALTH_PORT` | No | `7081` | Health check port (binds to 127.0.0.1) |
| `WORKSPACE` | No | `/workspace` | Bob Shell working directory |
| `BOB_MODE` | No | `interactive` | `interactive`, `plan`, or `auto` (changes the tmux command) |
| `IDLE_TIMEOUT_MS` | No | `300000` | Idle timeout (5 min default); suppressed by active relays |
| `TMUX_DEATH_GRACE_MS` | No | `5000` | How long the health server keeps serving 503 after the tmux session dies, before graceful shutdown proceeds |
| `GH_REPO` / `GH_PAT` / `GH_BRANCH` | No | — | Optional git integration (clone + session branch + commit/push) |

*Read from `/secrets/bobshell/api-key` by the Go daemon.

## Control Protocol

- Dial `GATEWAY_WSS/ws/agent?agent=<AGENT_ID>` with `Authorization: Bearer <RUN_TOKEN>` (never in the URL).
- Send `{"type":"register","services":[{"name":"ttyd","upstream":"ws://127.0.0.1:7080"}]}`.
- On `relay-open`: open the upstream to ttyd (tty subprotocol), send the ttyd 1.7.7 binary JSON handshake `{"AuthToken":"","columns":N,"rows":N}`, dial `/ws/relay?relayToken=...`, forward the first browser frame (resize), then pipe frames opaquely (opcode/FIN/payload preserved).
- On `relay-close`: close the upstream.
- On control loss: reconnect with backoff and re-register (tmux/ttyd stay running).

## Health Check

Port 7081 returns JSON: `{"status":"healthy","agent":"<id>"}` (HTTP 200) when the
tmux session is up, or `{"status":"unhealthy"}` (HTTP 503) otherwise. When the
tmux session dies, the health server keeps serving 503 for the bounded
`TMUX_DEATH_GRACE_MS` window (default 5s) so liveness probes can observe the
unhealthy state, then the graceful shutdown sequence proceeds (relays closed,
git finalized, ttyd/tmux stopped, exit 0).

## Session Persistence

Bob Shell runs inside a tmux session. The tmux session lives independently of
WebSocket connections:

- Browser disconnects → relay closes → ttyd still running → tmux still running → Bob Shell still running
- Browser reconnects → new relay attaches to the existing tmux session → scrollback replayed

## Graceful Shutdown

On SIGTERM/SIGINT the daemon closes active relays, finalizes git (commit/push
when configured), stops ttyd, kills the tmux session, and exits 0. The idle
timeout (no active relays for `IDLE_TIMEOUT_MS`) exits the same way.

## Tests

```bash
cd job-agent
go test ./...
go vet ./...
```

Unit tests cover config validation, the control loop (Bearer run token,
registration, reconnect with backoff, rejected re-dial), the ttyd adapter
(1.7.7 handshake, first-frame resize forwarding, opaque pipe), idle timeout
(configurable, suppressed by active relays), the health 503 window on tmux
death (observable and bounded by `TMUX_DEATH_GRACE_MS`), and graceful
shutdown.

## License

Copyright IBM Corporation 2024-2026 — Apache License 2.0
