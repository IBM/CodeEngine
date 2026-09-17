#!/usr/bin/env bash
# agents/opencode/run.sh
#
# Preset: opencode (OpenCode — open-source AI coding agent)
# Purpose: launches the opencode CLI. opencode reads the API key from the
#          environment automatically (ANTHROPIC_API_KEY or OPENAI_API_KEY).
# Runs as: jobagent (uid 1001), inside a tmux pane, via:
#          bash -lc /usr/local/bin/agent-run.sh
#
# Env vars required at runtime (at least one):
#   ANTHROPIC_API_KEY — Anthropic API key injected via Code Engine secret
#   OPENAI_API_KEY    — OpenAI API key injected via Code Engine secret

set -euo pipefail

opencode
