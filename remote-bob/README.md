# Remote Bob

Remote Bob gives you a **full AI agent terminal running in IBM Cloud Code Engine**, accessible from your local browser or directly via the apiserver URL. One command provisions the infrastructure; a second command opens the terminal. Close the browser — the session keeps running in the cloud. Open it again with a single command.

By default, Remote Bob runs **IBM Bob Shell**. With `--agent-preset` you can run any AI coding agent — Claude Code, OpenAI Codex CLI, Gemini CLI, OpenCode — or your own custom tool, without changing a single line of Go code.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **IBM Cloud account** | With permission to create Code Engine projects and Container Registry namespaces |
| **IBM Cloud API key** | Needs Code Engine Writer + Container Registry Writer roles |
| **Agent API key** | Bob Shell: [bob.ibm.com](https://bob.ibm.com) → Settings → API Keys. Other agents: see the `.env.template`. |
| **`ibmcloud` CLI** | [Install](https://cloud.ibm.com/docs/cli) — the `code-engine` plugin is installed/updated automatically |
| **`jq`** | `brew install jq` / `apt install jq` |
| **`curl`**, **`openssl`** | Included on macOS and most Linux distros |
| **Google Chrome** | Auto-detected on macOS (`/Applications/Google Chrome.app`) and Linux (`google-chrome`) |

---

## Quickstart (IBM Bob Shell — default)

```bash
# 1. Copy the config template and fill in your keys
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

## Using a different AI agent

Pass `--agent-preset=PATH` to `--setup` to build the container with a different tool. The preset is a directory containing `install.sh` (runs at build time) and `run.sh` (runs at session start). Built-in presets live under `job-agent/agents/`.

```bash
# Claude Code
./remote-bob --setup --agent-preset=job-agent/agents/claude
# → set ANTHROPIC_API_KEY in .env

# OpenAI Codex CLI
./remote-bob --setup --agent-preset=job-agent/agents/openai
# → set OPENAI_API_KEY in .env

# Gemini CLI
./remote-bob --setup --agent-preset=job-agent/agents/gemini
# → set GEMINI_API_KEY in .env

# OpenCode
./remote-bob --setup --agent-preset=job-agent/agents/opencode
# → set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env

# Plain bash shell (useful for testing or exploration)
./remote-bob --setup --agent-preset=job-agent/agents/bash

# Custom agent (copy an existing preset and adapt install.sh + run.sh)
cp -r job-agent/agents/bash job-agent/agents/my-agent
# … edit job-agent/agents/my-agent/install.sh and run.sh …
./remote-bob --setup --agent-preset=job-agent/agents/my-agent
```

After `--setup` with a new preset, `--new-session` starts a session using the newly built image. Each preset creates a separate CE job definition (`remote-bob-job-agent-<preset-name>`), so you can switch between presets without tearing down and rebuilding everything from scratch.

### API keys and secrets

All non-infrastructure variables in `.env` are automatically injected into the job container as environment variables. Simply add the key for your agent to `.env`:

```bash
# For Claude Code:
ANTHROPIC_API_KEY=sk-ant-...

# For OpenAI Codex CLI:
OPENAI_API_KEY=sk-...

# For Gemini CLI:
GEMINI_API_KEY=...

# Any custom variable your agent or run.sh needs:
MY_CUSTOM_VAR=value
```

Then run `./remote-bob --setup` (or just `./remote-bob --new-session` if the image is already built) — the secret is updated automatically.

---

## Command reference

| Command | What it does |
|---|---|
| `--setup` | Provisions IBM Cloud resources (resource group, CE project, secrets) and builds the apiserver and job-agent container images. **Idempotent** — safe to re-run after code or config changes. Accepts `--agent-preset=PATH`. |
| `--new-session` | Submits a new job run, waits for the agent to connect, and opens Chrome. Requires `--setup` to have completed. |
| `--connect` | Queries IBM Cloud for the live session and reopens the Chrome terminal. No re-provisioning. |
| `--end-session` | Gracefully disconnects the agent and deletes all job runs. Leaves the app and job definition in place so the next `--new-session` starts in seconds. |
| `--clean` | Deletes all provisioned IBM Cloud resources: job runs, job, app, secrets, CE project, resource group. |
| *(no args)* | Logs in and prints current infrastructure + session status with a suggested next command. |

All commands accept `--config=FILE` to use a config file other than `.env`.

---

## Browser access

**Local (Chrome, `file://`):** By default, `./remote-bob --new-session` or `./remote-bob --connect` opens Chrome automatically with the `browser-client/single-session.html` page.

**Hosted Web UI (any browser / `--web`):** The apiserver also serves the terminal UI at `/ui/` directly from its public URL. Pass the `--web` flag to bypass local Chrome launch and only output the URL:

```bash
# Start session and get web link directly (no local Chrome opened):
./remote-bob --new-session --web

# Reconnect and get web link for existing session:
./remote-bob --connect --web
```

Output:
```
Session live
  Agent:  agent-xxxx
  API:    https://<apiserver-url>
  Web UI: https://<apiserver-url>/ui/?agent=agent-xxxx
```

Open that URL in any browser on any device — no Chrome, no `file://`, no local files needed.

---

## Configuration

Copy `.env.template` to `.env`. Required keys depend on the chosen preset:

```bash
# Always required
GATEWAY_PASSWORD=any-password-you-choose
IBMCLOUD_API_KEY=your-ibm-cloud-api-key

# Required for the default bob preset
BOBSHELL_API_KEY=your-bob-shell-api-key

# Required for other presets (add the key for your chosen agent)
# ANTHROPIC_API_KEY=...   # claude / opencode
# OPENAI_API_KEY=...      # openai / opencode
# GEMINI_API_KEY=...      # gemini
```

All other variables in `.env` that are not infrastructure keys are automatically forwarded to the container. Optional overrides (region, CPU, memory, timeout, etc.) are fully documented in `.env.template`.

---

## Writing a custom agent preset

A preset is a directory containing two bash scripts:

**`install.sh`** — runs as root at Docker build time. Install your tool and configure it for non-interactive operation. Node.js 22, `npm`, `curl`, `jq`, and `tmux` are already available.

```bash
#!/usr/bin/env bash
set -euo pipefail
# Example: install a hypothetical agent
npm install -g my-agent-cli
my-agent --version
```

**`run.sh`** — runs as `jobagent` (uid 1001) inside a tmux session. The last command should be the invocation of your interactive tool. All environment variables from `.env` (including API keys) are available.

```bash
#!/usr/bin/env bash
set -euo pipefail
my-agent --non-interactive --api-key "$MY_AGENT_API_KEY"
```

Then run `--setup` with the path to your preset directory:

```bash
./remote-bob --setup --agent-preset=/path/to/my-preset
# or relative to remote-bob/:
./remote-bob --setup --agent-preset=job-agent/agents/my-preset
```

---

## How it works

```
Browser (Chrome, file:// page or https://<apiserver>/ui/)
  │  WebSocket  /ws/browser?token=<wsToken>&agent=<id>&service=ttyd
  ▼
Apiserver  (Go, IBM Code Engine app, scales to zero)
  │  auth: POST /auth/login → 60s WS token
  │        POST /auth/runs  → per-run agent token (HMAC-signed)
  │  relay: opaque frame proxy — text + binary frames preserved verbatim
  │  static: GET /ui/* → browser-client terminal page
  │  WebSocket  /ws/agent  (Bearer <runToken>)
  ▼
Job-agent  (Go, IBM Code Engine job run — agent-agnostic)
  │  dials apiserver on startup, registers services
  │  opens upstream ttyd connection per relay request
  ▼
ttyd → tmux → /usr/local/bin/agent-run.sh (preset run.sh)
  ▼
AI agent (Bob Shell / Claude Code / OpenAI Codex CLI / Gemini CLI / OpenCode / …)
```

**Apiserver** is a thin authenticated relay deployed as a Code Engine application. It also serves the static browser-client UI at `/ui/`. Scales to zero when idle.

**Job-agent** is an agent-agnostic Go binary deployed as a Code Engine job run. It knows nothing about the specific AI tool — it starts tmux, runs `/usr/local/bin/agent-run.sh` (installed from the preset's `run.sh`), launches ttyd, and proxies terminal frames to the apiserver.

**Agent presets** are pairs of bash scripts (`install.sh` + `run.sh`) that live under `job-agent/agents/`. The chosen preset is baked into the container image at `--setup` time.

**Secrets** are stored in two Code Engine secrets:
- `remote-bob-gateway` — `GATEWAY_PASSWORD`, `ENCRYPTION_KEY` (apiserver)
- `remote-bob-agent-env` — all non-infrastructure keys from `.env` (job runs)

---

## Repository layout

```
remote-bob/
├── apiserver/           # Go apiserver — auth, registry, relay, static UI
│   ├── cmd/apiserver/
│   ├── internal/
│   ├── Dockerfile
│   └── go.mod
├── job-agent/           # Go job-agent — agent-agnostic tunnel daemon
│   ├── agents/          # Built-in agent presets
│   │   ├── bob/         # IBM Bob Shell (default)
│   │   ├── bash/        # Plain bash shell (testing)
│   │   ├── claude/      # Anthropic Claude Code
│   │   ├── openai/      # OpenAI Codex CLI
│   │   ├── gemini/      # Google Gemini CLI
│   │   └── opencode/    # OpenCode
│   ├── cmd/job-agent/
│   ├── internal/tunnel/
│   ├── Dockerfile
│   └── go.mod
├── browser-client/      # Static xterm.js terminal page (file:// or /ui/)
│   └── single-session.html
├── remote-bob           # Launcher — all commands
├── .env.template        # Config template
└── README.md
```

---

## Building and testing the Go modules

```bash
cd remote-bob/apiserver && go build ./... && go test ./...
cd remote-bob/job-agent  && go build ./... && go test ./...
```
