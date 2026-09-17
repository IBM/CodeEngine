---
title: "Remote Bob: Bring Your Own Agent"
date: 2026-09-15
description: "Extend Remote Bob to run Claude Code, OpenAI Codex CLI, Gemini CLI, OpenCode — or any tool you choose — in IBM Cloud Code Engine. One preset directory is all it takes."
tags: ["Bob", "code engine", "serverless", "AI", "Claude", "OpenAI", "Gemini", "automation"]
featureImage: "featured.jpg"
draft: false
authors: ["lukeroy", "joachimjordan"]
---

## Introduction

The [first Remote Bob post](../remote-bob-run-bob-shell-in-the-cloud/) showed how to run IBM Bob Shell as a serverless cloud workload on IBM Cloud Code Engine: one command provisions the infrastructure, a second command starts a session, and a browser terminal connects to the running agent in the cloud.

This post extends that foundation. Remote Bob now supports **agent presets** — a lightweight plugin model that lets you swap the AI tool running inside the container without touching a single line of Go code. The architecture is the same: Code Engine job run, WebSocket relay, xterm.js terminal. What changes is the tool at the end of the pipeline.

We will walk through running **Claude Code**, **OpenAI Codex CLI**, **Gemini CLI**, and **OpenCode** in the cloud, show how to write your own preset from scratch, and cover the two new quality-of-life improvements: a dynamic secret that automatically forwards all your `.env` keys into the container, and a hosted browser UI served directly from the apiserver endpoint.

---

## What Changed (and What Didn't)

### What stayed the same

Everything documented in the original post still works exactly as written. The commands `--setup`, `--new-session`, `--connect`, `--end-session`, and `--clean` behave identically. The `.env` keys `BOBSHELL_API_KEY`, `GATEWAY_PASSWORD`, and `IBMCLOUD_API_KEY` are still the only required values for the default Bob Shell flow. The browser client still works from `file://` with Chrome. Nothing is removed, nothing is renamed.

### What's new

**Agent presets.** The `job-agent/Dockerfile` no longer hard-codes Bob Shell installation. Instead it reads from a preset directory chosen at `--setup` time. Each preset is two bash scripts: `install.sh` (runs at Docker build time) and `run.sh` (runs inside tmux when the session starts). Built-in presets for Bob Shell, Claude Code, OpenAI Codex CLI, Gemini CLI, OpenCode, and plain Bash live under `job-agent/agents/`.

**`--agent-preset=PATH` flag.** Pass a path to any preset directory on `--setup`. The path can be relative to the `remote-bob/` directory or absolute — which means a directory outside the repo is supported, giving you a fully custom agent without forking anything.

**Dynamic agent secret.** The old `remote-bob-bobshell` CE secret (hard-coded to `BOBSHELL_API_KEY`) is replaced by `remote-bob-agent-env` — a dynamically built secret that includes every non-infrastructure variable from your `.env` file. Add `ANTHROPIC_API_KEY` to `.env`, run `--setup`, and it is automatically available in the container. No script changes needed.

**Hosted browser UI.** The apiserver now serves the browser-client terminal page at `/ui/` directly from its public URL. After `--new-session`, the launcher prints a Web UI URL you can open in any browser — no local `file://` page, no Chrome required.

**Agent-agnostic Go binary.** The job-agent no longer contains any Bob-specific logic. It starts tmux, launches `/usr/local/bin/agent-run.sh` (the preset's `run.sh`, installed at build time), starts ttyd, and proxies frames to the apiserver. The Go code knows nothing about Bob, Claude, or any specific tool.

---

## How the Preset System Works

The preset selection happens at `--setup` time. The launcher:

1. Validates that the chosen preset directory contains `install.sh` and `run.sh`.
2. Writes the preset name to `job-agent/agents/selected-preset` — a one-line file the Dockerfile reads.
3. Writes a dynamic `.ceignore` that excludes all other preset directories from the CE source upload, keeping the build context small.
4. Triggers the CE job build from the `remote-bob/` root. The Dockerfile copies `job-agent/agents/` into the image, reads `selected-preset`, runs `install.sh` as root, and installs `run.sh` as `/usr/local/bin/agent-run.sh`.

At session start, the job-agent starts tmux and runs `bash -lc /usr/local/bin/agent-run.sh`. All environment variables from the CE secret (`remote-bob-agent-env`) are available inside the tmux session — including the agent's API key.

Each preset creates a distinct CE job definition (`remote-bob-job-agent-<preset-name>`). A Bob setup and a Claude setup coexist independently. Switch presets by running `--setup` again with a different `--agent-preset`; it does not touch the other job definition.

---

## Running Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is Anthropic's agentic coding tool. It reads files, writes code, runs commands, and works autonomously through multi-step tasks.

### 1. Add your Anthropic API key

Open `.env` and add:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Leave `BOBSHELL_API_KEY` in place if you still use the Bob preset. Both keys coexist in `.env` and each flows into the right secret automatically.

### 2. Build the Claude image

```bash
./remote-bob --setup --agent-preset=job-agent/agents/claude
```

This builds a new CE job definition `remote-bob-job-agent-claude`. The apiserver is shared — it is only rebuilt if its source changed.

### 3. Start a session

```bash
./remote-bob --new-session
```

The launcher resolves the active job name from `job-agent/agents/selected-preset` and submits a Claude job run. The terminal opens and Claude Code starts with `--dangerously-skip-permissions` — the flag that suppresses interactive approval prompts and lets Claude operate autonomously.

---

## Running OpenAI Codex CLI

[OpenAI Codex CLI](https://github.com/openai/codex) is OpenAI's terminal-based coding agent. It reads `OPENAI_API_KEY` from the environment and operates autonomously on files in the working directory.

```bash
# .env
OPENAI_API_KEY=sk-your-key-here

# Build
./remote-bob --setup --agent-preset=job-agent/agents/openai

# Start
./remote-bob --new-session
```

---

## Running Gemini CLI

[Gemini CLI](https://github.com/google-gemini/gemini-cli) is Google's open-source AI agent. It reads `GEMINI_API_KEY` from the environment.

```bash
# .env
GEMINI_API_KEY=your-gemini-api-key-here

# Build
./remote-bob --setup --agent-preset=job-agent/agents/gemini

# Start
./remote-bob --new-session
```

Gemini CLI starts with `--yolo` to suppress interactive confirmation prompts, allowing it to execute tool calls autonomously.

---

## Running OpenCode

[OpenCode](https://opencode.ai/) is an open-source AI coding agent that supports multiple model providers. Configure it with whichever API key matches your chosen provider.

```bash
# .env — use the provider you prefer
ANTHROPIC_API_KEY=sk-ant-...
# or: OPENAI_API_KEY=sk-...

# Build
./remote-bob --setup --agent-preset=job-agent/agents/opencode

# Start
./remote-bob --new-session
```

---

## Writing Your Own Preset

Any tool that can run non-interactively in a terminal can be a preset. The interface is two bash scripts.

### `install.sh`

Runs as root at Docker build time. The base image is `debian:bookworm-slim` with Node.js 22, npm, curl, jq, and tmux pre-installed. Install whatever your tool needs.

```bash
#!/usr/bin/env bash
# agents/my-agent/install.sh
set -euo pipefail

echo "Installing my-agent..."
npm install -g my-agent-cli
my-agent --version
echo "Done."
```

### `run.sh`

Runs as `jobagent` (uid 1001) inside a tmux session. All environment variables from your `.env` — including any API keys — are available. End with `exec` so the process replaces the shell and tmux exits cleanly when the agent finishes.

```bash
#!/usr/bin/env bash
# agents/my-agent/run.sh
set -euo pipefail

exec my-agent --non-interactive --workspace /workspace
```

### Use it

```bash
cp -r job-agent/agents/bash job-agent/agents/my-agent
# edit install.sh and run.sh
./remote-bob --setup --agent-preset=job-agent/agents/my-agent
./remote-bob --new-session
```

The preset path can also point anywhere on your filesystem — it does not need to be inside the repository:

```bash
./remote-bob --setup --agent-preset=/home/user/my-custom-agent
```

### Adding custom environment variables

Any key you add to `.env` that is not one of the infrastructure keys (`IBMCLOUD_API_KEY`, `GATEWAY_PASSWORD`, `CE_REGION`, etc.) is automatically included in the `remote-bob-agent-env` CE secret and injected into every job run. No script changes, no manual secret management.

```bash
# .env
MY_AGENT_API_KEY=abc123
MY_AGENT_ENDPOINT=https://api.example.com
MY_CUSTOM_SETTING=value
```

After adding these, run `./remote-bob --setup` (or just `--new-session` if the image is current) — the secret is updated and the next job run has all three variables available.

---

## The Hosted Browser UI

The apiserver now serves the browser-client terminal page at `/ui/`. When a session is running, the launcher prints:

```
Web UI: https://<apiserver-url>/ui/?agent=<agent-id>
```

Open that URL in any browser. The page authenticates with your `GATEWAY_PASSWORD`, opens a WebSocket to the relay, and renders the terminal — the same experience as the local `file://` page, but accessible from any device without needing the repository cloned locally.

The `file://` Chrome path still works identically. The hosted UI is an addition, not a replacement.

---

## Switching Between Agents

Because each preset creates its own CE job definition, you can maintain multiple builds side by side:

```bash
# Morning: use Bob Shell (already set up)
./remote-bob --new-session

# Switch to Claude for a specific task
./remote-bob --setup --agent-preset=job-agent/agents/claude
./remote-bob --new-session

# Switch back to Bob without rebuilding
./remote-bob --setup --agent-preset=job-agent/agents/bob
./remote-bob --new-session
```

`--setup` with an existing preset name skips the rebuild if the gateway URL hasn't changed. The switch is fast.

---

## Architecture Recap

```
Browser (Chrome file:// or https://<apiserver>/ui/)
  │  WebSocket  /ws/browser?token=<t>&agent=<id>&service=ttyd
  ▼
Apiserver  (Go, Code Engine app, scales to zero)
  │  relay + static file server
  ▼
Job-agent  (Go, Code Engine job run — agent-agnostic)
  │  tmux → /usr/local/bin/agent-run.sh
  ▼
Agent preset run.sh → AI tool (Bob / Claude / Codex / Gemini / OpenCode / …)
```

The job-agent is now a pure infrastructure component. It dials the apiserver, starts tmux+ttyd, and proxies frames. All agent-specific behaviour — what to install, how to start, what flags to pass — lives in the two bash scripts of the preset. Adding a new AI tool to the system means writing two bash scripts, not modifying any Go code.

---

## Summary

| What | How |
|---|---|
| Run Claude Code in the cloud | `--setup --agent-preset=job-agent/agents/claude` + `ANTHROPIC_API_KEY` in `.env` |
| Run OpenAI Codex CLI | `--setup --agent-preset=job-agent/agents/openai` + `OPENAI_API_KEY` in `.env` |
| Run Gemini CLI | `--setup --agent-preset=job-agent/agents/gemini` + `GEMINI_API_KEY` in `.env` |
| Run OpenCode | `--setup --agent-preset=job-agent/agents/opencode` + provider key in `.env` |
| Run a completely custom tool | Write `install.sh` + `run.sh`, pass path to `--agent-preset` |
| Inject any env var into the container | Add it to `.env`; it flows automatically into the CE secret |
| Access the terminal from any browser | Open the `/ui/` URL printed by `--new-session` |
| Keep using Bob Shell | Nothing changes — `--setup` with no `--agent-preset` is unchanged |

Remote Bob started as a way to run Bob Shell in the cloud. It is now a general-purpose serverless agent runner. The Code Engine infrastructure handles the lifecycle; the preset system handles the tool. Bring your agent, point it at a job run, and let Code Engine take care of the rest.

## Resources

- [IBM Cloud Code Engine](https://www.ibm.com/products/code-engine)
- [Code Engine Documentation](https://cloud.ibm.com/docs/codeengine)
- [Code Engine Sample Repository](https://github.com/IBM/CodeEngine) — Remote Bob source code
- [Bob (watsonx Code Assistant)](https://www.ibm.com/products/watsonx-code-assistant)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [OpenAI Codex CLI](https://github.com/openai/codex)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [OpenCode](https://opencode.ai/)
