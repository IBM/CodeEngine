#!/usr/bin/env bash
# agents/claude/run.sh
#
# Preset: claude (Anthropic Claude Code CLI)
# Purpose: launches Claude Code CLI in headless/non-interactive mode.
#          --dangerously-skip-permissions suppresses all interactive approval
#          prompts, which is required for unattended operation inside the agent.
# Runs as: jobagent (uid 1001), inside a tmux pane, via:
#          bash -lc /usr/local/bin/agent-run.sh
#
# Env vars required at runtime:
#   ANTHROPIC_API_KEY — Anthropic API key injected via Code Engine secret

set -euo pipefail

claude --dangerously-skip-permissions
