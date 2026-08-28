# Remote Bob

Remote Bob is a **generic, authenticated tunnel** that carries remote
services (first service: a Bob Shell terminal) from a job-agent container to
a static browser page. One `run.sh` invocation starts one apiserver, one
job-agent running Bob Shell inside `tmux` + `ttyd`, and opens a minimal
Chrome app with an xterm.js terminal. When you close the Chrome app,
everything is torn down automatically.

## Architecture overview

```
Browser (xterm.js, static file:// page)
        │  WS /ws/browser?token=<wsToken>&agent=<agentId>&service=ttyd
        ▼
apiserver (Go, :3000 host / :8080 container)
   - REST: POST /auth/login (Basic) → 60s single-use WS token
           POST /auth/runs?agent=<id> (Basic) → per-run agent token
           GET  /agents (Basic) → registered agents + services
           GET  /healthz, /readyz (public)
   - Agent registry (in-memory, multi-agent, no DB)
   - Opaque frame relay (text + binary preserved)
        │  control WS /ws/agent (Authorization: Bearer <runToken>)
        │  relay WS   /ws/relay?relayToken=<one-time>  (one per browser)
        ▼
job-agent tunnel daemon (Go, in container)
   - Control connection: dial /ws/agent, register services
   - Relay handling: on relay-open, open upstream to the local service, pipe
   - ttyd adapter: tmux + ttyd on 127.0.0.1:7080, ttyd 1.7.7 handshake
   - Health server 127.0.0.1:7081, git integration, idle timeout
        │  raw ttyd WS (binary frames, tty subprotocol)
        ▼
ttyd → tmux → Bob Shell
```

The apiserver is a thin authenticated relay: it authenticates clients and
agents, keeps an in-memory registry of registered agents, and forwards
WebSocket frames opaquely (opcode, FIN bit, and payload bytes preserved). It
has **no session management, no SQLite, no persistence, and no webserver**.
The job-agent is a single Go binary that keeps tmux + ttyd + health + git
integration + Bob Shell config seeding and replaces the legacy Node/bash
bridge with a generic tunnel daemon.

See [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md) for the
full design (protocols, auth model, ports, operational behaviors),
[documentation/ENVIRONMENT.md](documentation/ENVIRONMENT.md) for the
environment-variable reference, and
[documentation/SECURITY.md](documentation/SECURITY.md) for the security
model.

## Repository layout

```
remote-bob/
├── apiserver/          # Apiserver (Go): auth, agent registry, opaque relay
│   ├── cmd/apiserver/
│   ├── internal/
│   ├── vendor/
│   ├── go.mod
│   └── README.md
├── browser-client/     # Standalone xterm.js terminal page (static, file://)
│   ├── single-session.html
│   ├── single-session.js
│   └── xterm.js / xterm.css / addon-fit.js / fonts/
├── job-agent/          # Job-agent tunnel daemon (Go)
│   ├── cmd/job-agent/
│   ├── internal/tunnel/
│   ├── vendor/
│   ├── go.mod
│   └── README.md
├── documentation/      # ARCHITECTURE.md, ENVIRONMENT.md, SECURITY.md,
│                       # EXTENSIBILITY.md, PROJECT-ARCHITECTURE.md
├── scripts/            # test-runsh.sh, integration-e2e.sh,
│                       # integration-ce-e2e.sh, integration/ helpers
├── run.sh              # Unified launcher (local and Code Engine modes)
├── plans/
├── .gitignore
└── README.md
```

## Quick start (local mode)

1. Copy the config template in the project root and fill in your credentials:

   ```bash
   cp .env.template .env
   # then edit .env:
   # BOBSHELL_API_KEY=your-bobshell-api-key
   # GATEWAY_PASSWORD=your-gateway-password
   ```

2. Run the launcher:

   ```bash
   ./run.sh --mode=local --config=.env
   ```

   The script will:
   - generate and persist `GATEWAY_TOKEN` and `ENCRYPTION_KEY` in `.env` if
     they are missing (idempotent — reused on subsequent runs),
   - build the apiserver and job-agent images (rebuilt on every invocation;
     builds are cached),
   - start the apiserver on host port 3000 (`API_PORT` overrides),
   - issue a per-run agent token via `POST /auth/runs` and start the
     job-agent container with `AGENT_ID` + `RUN_TOKEN`,
   - wait for the agent to register and report `ready` via `GET /agents`,
   - open `browser-client/single-session.html` in a dedicated Chrome app
     window (fresh isolated profile).

3. Enter the gateway password in the login prompt, then use the terminal.
   When you close the Chrome app window, `run.sh` tears everything down
   (containers, network, Chrome profile, temp dirs).

### Local mode requirements

- `podman` (preferred) or `docker` (aliased) for container builds and runs
- `google-chrome` (or `google-chrome-stable`) in PATH
- `curl`, `jq`, `openssl`, `sha256sum`
- Go 1.25+ only if you build/test the Go modules directly

## Code Engine mode

`run.sh` also supports `--mode=codeengine`, which provisions IBM Code Engine
resources, deploys the apiserver app, submits a job-agent job run, and opens
the Chrome app:

```bash
./run.sh --mode=codeengine --config=.env
```

This mode requires live IBM Cloud credentials (`IBMCLOUD_API_KEY`, plus
`CE_REGION`, `CE_PROJECT`, and `RESOURCE_GROUP`). The flow: isolated
`IBMCLOUD_HOME` → login → provision secrets + configmap (idempotent) →
deploy/update the apiserver app → ensure the job-agent job (rebuilt only
when missing or stale) → `POST <app-url>/auth/runs` → submit a job run with
`AGENT_ID` + `RUN_TOKEN` → wait for agent ready → Chrome at the deployed
app. Closing the browser deletes the job run and the app (or scales it to
zero with `CE_CLEANUP_APP=stop`).

## Building and testing

The apiserver and job-agent are independent Go modules. Build and test from
within each directory:

```bash
cd apiserver
go build ./...
go test ./...
go vet ./...
```

```bash
cd job-agent
go build ./...
go test ./...
go vet ./...
```

The full test suite for the launcher:

```bash
bash scripts/test-runsh.sh
```

This asserts the run.sh behaviors (CLI validation, config validation,
credential generation idempotency, build/tarball/network behavior, local
auth/agent flow, readiness wait, teardown, redaction, CE-mode structure).
It takes ~4-6 minutes and requires podman/docker, curl, jq, openssl,
google-chrome, and a `.env` with `BOBSHELL_API_KEY` + `GATEWAY_PASSWORD`.

The end-to-end integration suite drives the full stack against a real
run.sh local session (login, echo, resize, reconnect, tmux persistence,
auth rejection at every layer, opaque frame probes, multi-agent fan-out,
idle teardown, browser crash/refresh/sleep-wake journeys):

```bash
bash scripts/integration-e2e.sh
```

The Code Engine journey is a separate, expensive script guarded by CE
credentials:

```bash
bash scripts/integration-ce-e2e.sh
```

## Environment variables

Required in `.env` (both modes): `BOBSHELL_API_KEY`, `GATEWAY_PASSWORD`.
Code Engine mode additionally requires `IBMCLOUD_API_KEY`, `CE_REGION`,
`CE_PROJECT`, `RESOURCE_GROUP`. `GATEWAY_TOKEN` and `ENCRYPTION_KEY` are
generated and persisted when missing.

See [documentation/ENVIRONMENT.md](documentation/ENVIRONMENT.md) for the
complete reference, including the job-agent daemon variables
(`AGENT_ID`, `RUN_TOKEN`, `GATEWAY_WSS`, `TTYD_PORT`, `HEALTH_PORT`,
`BOB_MODE`, `IDLE_TIMEOUT_MS`, git vars) and the removed v3 variables
(`SESSION_ID`, `SESSION_TOKEN`, `GATEWAY_CALLBACK_URL`).

## Operational behaviors

- **Image rebuild policy:** local mode rebuilds both images on every
  invocation (cached layers). Code Engine mode rebuilds the job-agent job
  only when it is missing or stale; a current job is reused with an env-var
  refresh.
- **Crash mid-run:** if the apiserver or job-agent container stops while
  Chrome is open, run.sh tears down the session and exits non-zero with a
  clear error.
- **Env var precedence:** shell environment > `.env` config file; generated
  credentials are reused, not regenerated.

See [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md) §6 for
details.

## Important notes

- **One session per invocation.** `run.sh` is the single entrypoint; each
  invocation creates one agent with a unique `AGENT_ID`. The apiserver
  registry is multi-agent capable, but there is no session management and no
  session history.
- **No SQLite persistence.** Configuration is loaded from the `.env` file
  (or Code Engine secrets in Code Engine mode). There is no database, no
  settings sync, and no session history.
- **No webserver.** The browser client is loaded from `file://` and connects
  directly to the apiserver WebSocket.
- **Mutual auth.** The browser authenticates with the gateway password
  (Basic) for a 60s single-use WS token; the job-agent authenticates with a
  per-run token in the `Authorization: Bearer` header. No long-lived
  credentials in URLs; no credentials in logs.
- **Bob Shell is downloaded at build time.** `run.sh` downloads the latest
  Bob Shell from `https://bob.ibm.com/releases?bob=shell` when a local
  tarball is missing, verifies its sha256, caches it in the repo root, and
  passes it to the job-agent build. The tarball is listed in `.gitignore`
  and must not be committed.
- **Vendored dependencies.** Do not modify `vendor/` directories; each
  component vendors its own Go dependencies.

## Repository URL

Target remote: `github.ibm.com/JORDANJ/remote-bob`
# dirty
