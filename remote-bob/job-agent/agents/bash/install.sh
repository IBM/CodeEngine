#!/usr/bin/env bash
# agents/bash/install.sh
#
# Preset: bash (testing / debug)
# Purpose: no-op — the bash preset needs no additional packages; bash is
#          already present in the base debian:bookworm-slim image.
# Runs as: root, at Docker build time.
# Env vars required at build time: (none)

set -euo pipefail

echo "bash preset: nothing to install."
