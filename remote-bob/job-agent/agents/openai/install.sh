#!/usr/bin/env bash
# agents/openai/install.sh
#
# Preset: openai (OpenAI Codex CLI)
# Purpose: installs the OpenAI Codex CLI globally via npm.
# Runs as: root, at Docker build time.
# Env vars required at build time: (none — API key is supplied at runtime)

set -euo pipefail

echo "openai preset: installing @openai/codex..."
npm install -g @openai/codex

# Verify installation
codex --version

echo "openai preset: installation complete."
