# Remote Bob

Remote Bob gives you a **full Bob Shell terminal running in IBM Cloud Code Engine**, accessible from your local browser. One command provisions the infrastructure; a second command opens the terminal. Close the browser — the session keeps running in the cloud. Open it again with a single command.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **IBM Cloud account** | With permission to create Code Engine projects and Container Registry namespaces |
| **IBM Cloud API key** | Needs Code Engine Writer + Container Registry Writer roles |
| **Bob Shell API key** | Get from [bob.ibm.com](https://bob.ibm.com) → Settings → API Keys |
| **`ibmcloud` CLI** | [Install](https://cloud.ibm.com/docs/cli) — the `code-engine` plugin is installed/updated automatically |
| **`jq`** | `brew install jq` / `apt install jq` |
| **`curl`**, **`openssl`** | Included on macOS and most Linux distros |
| **Google Chrome** | Auto-detected on macOS (`/Applications/Google Chrome.app`) and Linux (`google-chrome`) |

---

## Quickstart

```bash
# 1. Copy the config template and fill in your three keys
cp .env.template .env
#   BOBSHELL_API_KEY=...
#   GATEWAY_PASSWORD=choose-any-password
#   IBMCLOUD_API_KEY=...

# 2. Provision IBM Cloud resources and build container images (~20 min first time)
./remote-bob --setup

# 3. Start a session — opens a Chrome terminal window
./remote-bob --new-session

# 4. Close the browser window when done. The session keeps running in the cloud.

# 5. Reopen the browser for the same running session
./remote-bob --connect

# 6. End the session (stops the job run; infrastructure stays for fast restart)
./remote-bob --end-session

# 7. Start another session without rebuilding
./remote-bob --new-session

# 8. Remove all IBM Cloud resources when finished
./remote-bob --clean

# Check current status at any time
./remote-bob
```

---

## Command reference

| Command | What it does |
|---|---|
| `--setup` | Provisions IBM Cloud resources (resource group, CE project, secrets) and builds the apiserver and job-agent container images. **Idempotent** — safe to re-run after code changes. |
| `--new-session` | Submits a new job run, waits for the agent to connect, and opens Chrome. Requires `--setup` to have completed. Prevents starting a second session if one is already live. |
| `--connect` | Queries IBM Cloud for the live session and reopens the Chrome terminal. No re-provisioning. |
| `--end-session` | Gracefully disconnects the agent and deletes all job runs. Leaves the app and job definition in place so the next `--new-session` starts in seconds. |
| `--clean` | Deletes all provisioned IBM Cloud resources: job runs, job, app, secrets, CE project, resource group. |
| *(no args)* | Logs in and prints current infrastructure + session status with a suggested next command. |

All commands accept `--config=FILE` to use a config file other than `.env`.

---

## Configuration

Copy `.env.template` to `.env`. Only the three required keys need to be set:

```bash
# Required
BOBSHELL_API_KEY=your-bob-shell-api-key
GATEWAY_PASSWORD=any-password-you-choose
IBMCLOUD_API_KEY=your-ibm-cloud-api-key
```

Everything else has sensible defaults (region `us-east`, auto-generated `ENCRYPTION_KEY`, etc.). See `.env.template` for the full list of optional settings such as `BOB_MODE`, `DEFAULT_CPU`, `DEFAULT_MEMORY`, and `CHROME_BIN`.

**The `.env` file is never modified at runtime.** Session state (app URL, agent ID) is retrieved live from IBM Cloud on every invocation.

---

## How it works

```
Browser (Chrome, file:// page, xterm.js)
  │  WebSocket  /ws/browser?token=<wsToken>&agent=<id>&service=ttyd
  ▼
Apiserver  (Go, IBM Code Engine app, scales to zero)
  │  auth: POST /auth/login → 60s WS token
  │        POST /auth/runs  → per-run agent token (HMAC-signed)
  │  relay: opaque frame proxy — text + binary frames preserved verbatim
  │  WebSocket  /ws/agent  (Bearer <runToken>)
  ▼
Job-agent  (Go, IBM Code Engine job run)
  │  dials apiserver on startup, registers services
  │  opens upstream ttyd connection per relay request
  ▼
ttyd → tmux → Bob Shell
```

**Apiserver** is a thin authenticated relay deployed as a Code Engine application. It holds an in-memory agent registry, issues short-lived tokens, and proxies WebSocket frames between the browser and the job-agent without inspecting the payload. It has no database and no persistence; it shuts itself down when the last agent disconnects.

**Job-agent** is a Go binary deployed as a Code Engine job run. On startup it dials the apiserver control WebSocket, registers the `ttyd` service, and handles relay connections by piping raw frames between the apiserver and a local `ttyd` process. It runs `tmux` → Bob Shell inside `ttyd` and serves a health endpoint for the job run lifecycle. An idle timeout shuts it down automatically when not in use.

**Browser client** is a single self-contained HTML file loaded from `file://`. It authenticates with the gateway password, opens a WebSocket relay, and renders the terminal using xterm.js. No server-side rendering, no CDN dependencies.

**Secrets** are stored in two IBM Code Engine secrets injected as environment variables:
- `remote-bob-gateway` — `GATEWAY_PASSWORD`, `ENCRYPTION_KEY`
- `remote-bob-bobshell` — `BOBSHELL_API_KEY`

---

## Repository layout

```
remote-bob/
├── apiserver/           # Go apiserver — auth, registry, relay
│   ├── cmd/apiserver/
│   ├── internal/
│   ├── Dockerfile
│   └── go.mod
├── job-agent/           # Go job-agent — tunnel daemon, ttyd, tmux, Bob Shell
│   ├── cmd/job-agent/
│   ├── internal/tunnel/
│   ├── Dockerfile
│   └── go.mod
├── browser-client/      # Static xterm.js terminal page (file://)
│   └── single-session.html
├── remote-bob               # Launcher — all commands
├── .env.template        # Config template
└── README.md
```

---

## Building and testing the Go modules

```bash
cd remote-bob/apiserver && go build ./... && go test ./...
cd remote-bob/job-agent  && go build ./... && go test ./...
```
