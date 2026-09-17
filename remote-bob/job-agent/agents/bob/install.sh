#!/usr/bin/env bash
# agents/bob/install.sh
#
# Preset: bob (default — IBM Bob Shell)
# Purpose: downloads and installs the latest Bob Shell release, then
#          pre-configures Bob Shell for the jobagent user so it starts
#          non-interactively with auto-approve and telemetry disabled.
# Runs as: root, at Docker build time.
# Env vars required at build time: (none — release URL is hard-coded)

set -euo pipefail

# ── Download Bob Shell tarball ────────────────────────────────────────────────
echo "bob preset: fetching Bob Shell version..."
curl -fsSL \
    https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell2-version.txt \
    -o /tmp/bobshell-version.txt
BOBSHELL_VERSION="$(tr -d '[:space:]' < /tmp/bobshell-version.txt)"
echo "bob preset: installing Bob Shell ${BOBSHELL_VERSION}..."
curl -fsSL \
    "https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-${BOBSHELL_VERSION}.tgz" \
    -o /tmp/bobshell.tgz
rm /tmp/bobshell-version.txt

# ── Install Bob Shell via npm ─────────────────────────────────────────────────
npm install -g /tmp/bobshell.tgz
rm /tmp/bobshell.tgz

# ── Verify installation ───────────────────────────────────────────────────────
bob --version

# ── Pre-configure Bob Shell for the jobagent user ────────────────────────────
# This avoids all interactive prompts (license, telemetry, trust) on first run.
mkdir -p /home/jobagent/.bob/settings

jq -n '{
  "autoAcceptLicense":    true,
  "autoAcceptIbmLicense": true,
  "telemetry":            {"enabled": false},
  "autoTrustWorkspace":   true,
  "approvalMode":         "auto_approve",
  "ibm": {
    "isNotFirstTime": true,
    "licenseConsent": true
  },
  "prev_version": "2.0.0",
  "bobShell": {
    "autoUpdate":     false,
    "lastRunVersion": "2.0.0"
  }
}' > /home/jobagent/.bob/settings/settings.json

jq -n '{"version":1,"folders":{"/workspace":"TRUST_FOLDER"}}' \
    > /home/jobagent/.bob/trustedFolders.json

chown -R jobagent:jobagent /home/jobagent/.bob

echo "bob preset: installation complete."
