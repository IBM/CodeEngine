#!/usr/bin/env bash
# agents/claude/install.sh
#
# Preset: claude (Anthropic Claude Code CLI)
# Purpose: installs the Claude Code CLI globally via npm.
# Runs as: root, at Docker build time.
# Env vars required at build time: (none — API key is supplied at runtime)

set -euo pipefail

echo "claude preset: installing @anthropic-ai/claude-code..."
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

echo "claude preset: installation complete."
