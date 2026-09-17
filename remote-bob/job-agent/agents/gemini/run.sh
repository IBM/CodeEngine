#!/usr/bin/env bash
# agents/gemini/run.sh
#
# Preset: gemini (Google Gemini CLI)
# Purpose: launches the Google Gemini CLI. The --yolo flag enables non-interactive
#          / auto-approve mode so the agent does not block on confirmation prompts.
# Runs as: jobagent (uid 1001), inside a tmux pane, via:
#          bash -lc /usr/local/bin/agent-run.sh
#
# Env vars required at runtime:
#   GEMINI_API_KEY  — Google Gemini API key injected via Code Engine secret
#   (or GOOGLE_API_KEY — alternative env var name accepted by the Gemini CLI)

set -euo pipefail

gemini --yolo
