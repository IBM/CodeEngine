#!/usr/bin/env bash
# agents/opencode/install.sh
#
# Preset: opencode (OpenCode — open-source AI coding agent)
# Purpose: installs the opencode-ai CLI globally via npm.
# Runs as: root, at Docker build time.
# Env vars required at build time: (none — API key is supplied at runtime)

set -euo pipefail

echo "opencode preset: installing opencode-ai..."
npm install -g opencode-ai

# Verify installation
opencode --version

echo "opencode preset: installation complete."
