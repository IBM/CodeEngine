#!/usr/bin/env bash
# agents/openai/run.sh
#
# Preset: openai (OpenAI Codex CLI)
# Purpose: launches the OpenAI Codex CLI. Codex reads OPENAI_API_KEY from the
#          environment automatically — no additional flags are required.
# Runs as: jobagent (uid 1001), inside a tmux pane, via:
#          bash -lc /usr/local/bin/agent-run.sh
#
# Env vars required at runtime:
#   OPENAI_API_KEY — OpenAI API key injected via Code Engine secret

set -euo pipefail

exec codex
