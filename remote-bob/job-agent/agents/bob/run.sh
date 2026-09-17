#!/usr/bin/env bash
# agents/bob/run.sh
#
# Preset: bob (default — IBM Bob Shell)
# Purpose: launches Bob Shell in non-interactive chat mode with auto-approve.
#          Supports BOB_MODE for selecting a specific operational mode.
# Runs as: jobagent (uid 1001), inside a tmux pane, via:
#          bash -lc /usr/local/bin/agent-run.sh
#
# Env vars required at runtime:
#   BOBSHELL_API_KEY  — IBM API key injected via Code Engine secret (required)
#   BOB_MODE          — optional; controls --mode flag:
#                         "plan" → --mode autonomous-loop-planner
#                         "auto" → --mode auto
#                         (unset / any other value) → no --mode flag (default)

set -euo pipefail

# ── Resolve --mode flag from BOB_MODE ────────────────────────────────────────
MODE_ARGS=()
case "${BOB_MODE:-}" in
    plan) MODE_ARGS=(--mode autonomous-loop-planner) ;;
    auto) MODE_ARGS=(--mode auto) ;;
    *)    ;;
esac

# ── Launch Bob Shell ──────────────────────────────────────────────────────────
exec bob chat --auto-approve --trust --accept-license "${MODE_ARGS[@]}"
