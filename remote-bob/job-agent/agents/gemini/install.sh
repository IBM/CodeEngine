#!/usr/bin/env bash
# agents/gemini/install.sh
#
# Preset: gemini (Google Gemini CLI)
# Purpose: installs the Google Gemini CLI globally via npm.
# Runs as: root, at Docker build time.
# Env vars required at build time: (none — API key is supplied at runtime)

set -euo pipefail

echo "gemini preset: installing @google/gemini-cli..."
npm install -g @google/gemini-cli

# Verify installation
gemini --version

echo "gemini preset: installation complete."
