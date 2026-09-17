#!/usr/bin/env bash
# agents/bash/run.sh
#
# Preset: bash (testing / debug)
# Purpose: drop into an interactive bash shell — useful for manual inspection
#          and debugging the container environment.
# Runs as: jobagent (uid 1001), inside a tmux pane, via:
#          bash -lc /usr/local/bin/agent-run.sh
# Env vars required at runtime: (none)

set -euo pipefail

exec bash
