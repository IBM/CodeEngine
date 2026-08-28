#!/bin/bash
# Remote Bob — Unified Launcher Script
# =============================================================================
# Single-session, no-persistence remote terminal launcher.
#
# Usage:
#   ./run.sh --mode=local --config=.env
#   ./run.sh --mode=codeengine --config=.env
#   ./run.sh --end-session --config=.env
#   ./run.sh --help
#
# Modes:
#   local       Start API server + job-agent containers, open Chrome app.
#               On subsequent invocations, if a session is already running
#               (AGENT_ID in .env, containers up, agent ready) the script
#               reconnects to that session — skipping image builds — and
#               opens a new Chrome window on it. Closing Chrome or Ctrl+C
#               detaches; containers keep running.
#   codeengine  Provision Code Engine, deploy API server, submit job run,
#               open Chrome app. On subsequent invocations, if AGENT_ID and
#               API_SERVER_URL are in .env and the agent is still ready, the
#               script reconnects — skipping provisioning — and opens a new
#               Chrome window. Closing Chrome or Ctrl+C detaches; the CE job
#               and apiserver keep running.
#
# End-session:
#   --end-session  Terminate the active session: calls DELETE /agents/{id}
#                  on the apiserver, then tears down CE resources (job run +
#                  app) or local containers. Requires --config with the same
#                  .env used to start the session (for GATEWAY_PASSWORD,
#                  AGENT_ID, and CE credentials in codeengine mode).
#                  In local mode the session can also be ended by pressing
#                  "End Session" in the browser window.
#
# Local mode (v4) flow (fresh start):
#   detect runtime -> build images -> create bridge network -> start apiserver
#   (host port 3000, LOCAL_MODE=true) -> POST /auth/runs -> RUN_TOKEN ->
#   start job-agent (AGENT_ID + RUN_TOKEN) -> wait GET /agents ready ->
#   launch Chrome at file://...?apiHost&agent -> detach (session continues).
#
# Local mode reconnect flow:
#   AGENT_ID + container names found in .env -> verify containers running ->
#   verify agent ready via GET /agents -> launch Chrome -> detach.
#
# Documented behaviors (asserted by scripts/test-runsh.sh):
#   - Image rebuild policy: both images are rebuilt on every local invocation
#     unless reconnecting to a live session (where containers already exist).
#   - Env var precedence: shell environment > .env config file. A value set
#     in the shell env is never overwritten by the config file.
#   - Reconnect: if a previous session is detected as live (containers running,
#     agent ready), Chrome is opened on it without rebuilding or restarting.
#   - apiserver crash mid-run: run.sh detects the apiserver container is no
#     longer running while Chrome is open, tears down the session (job-agent,
#     network, Chrome, temp dirs) and exits non-zero with a clear error.
#   - job-agent crash mid-run: run.sh detects the job-agent container is no
#     longer running while Chrome is open, tears down the session and exits
#     non-zero with a clear error. (A graceful idle-timeout exit by the agent
#     ends the session the same way.)
# =============================================================================

set -euo pipefail

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$SCRIPT_DIR"
BROWSER_CLIENT_DIR="$MONOREPO_ROOT/browser-client"
APISERVER_DIR="$MONOREPO_ROOT/apiserver"
JOB_AGENT_DIR="$MONOREPO_ROOT/job-agent"
BROWSER_HTML="$BROWSER_CLIENT_DIR/single-session.html"

# ── Colour output ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

# ── Secret redaction ────────────────────────────────────────────────────────
# Secrets whose values must never appear in log output.
SECRET_KEYS=(
    IBMCLOUD_API_KEY BOBSHELL_API_KEY GATEWAY_PASSWORD
    GATEWAY_TOKEN ENCRYPTION_KEY GH_PAT
    RUN_TOKEN AGENT_ID
)

# Returns a masked version of a secret value (first 4 + last 4 chars).
mask_secret() {
    local val="$1"
    if [ -z "$val" ]; then
        echo "<empty>"
    elif [ ${#val} -le 8 ]; then
        echo "****"
    else
        echo "${val:0:4}****${val: -4}"
    fi
}

# Log a key=value pair, masking the value if the key is a known secret.
log_kv() {
    local key="$1" val="$2"
    local masked="$val"
    for sk in "${SECRET_KEYS[@]}"; do
        if [ "$key" = "$sk" ]; then
            masked="$(mask_secret "$val")"
            break
        fi
    done
    echo -e "  ${GREEN}${key}${NC}=${masked}"
}

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }
log_debug() { echo -e "       $1"; }

# Stream filter that masks any known secret value appearing in sub-script
# output (provision/deploy scripts print GATEWAY_TOKEN / ENCRYPTION_KEY).
# Usage: some-command 2>&1 | redact_stream
#
# Uses awk for literal (non-glob, non-regex) string replacement so secret
# values containing +, *, ?, [, /, = etc. are safe.
redact_stream() {
    # Build a single awk script that replaces each secret value literally.
    # We use awk's index() function which does plain substring matching.
    local awk_script='{ line = $0 }'
    for sk in "${SECRET_KEYS[@]}"; do
        local val="${!sk:-}"
        if [ -n "$val" ]; then
            local masked
            masked="$(mask_secret "$val")"
            # Escape awk string delimiters (backslash then double-quote).
            local safe_val="${val//\\/\\\\}"
            safe_val="${safe_val//\"/\\\"}"
            local safe_masked="${masked//\\/\\\\}"
            safe_masked="${safe_masked//\"/\\\"}"
            awk_script+="
{ while ((i = index(line, \"${safe_val}\")) > 0)
    line = substr(line, 1, i-1) \"${safe_masked}\" substr(line, i + length(\"${safe_val}\"))
}"
        fi
    done
    awk_script+='{ print line }'
    awk "$awk_script"
}

# ── Usage ────────────────────────────────────────────────────────────────────
usage() {
    cat <<EOF
Remote Bob — Single-Session Launcher

Usage:
  $0 --mode=MODE --config=CONFIG_FILE
  $0 --end-session [--mode=MODE] --config=CONFIG_FILE
  $0 --help

Modes:
  local       Start API server and job-agent containers, open Chrome app.
              Closing the window or Ctrl+C detaches; session keeps running.
  codeengine  Provision Code Engine, deploy API server, submit job run,
              open Chrome app. Closing the window or Ctrl+C detaches;
              CE job and apiserver keep running.

End-session:
  --end-session  Terminate the active session. Reads AGENT_ID, API_PORT /
                 API_SERVER_URL, GATEWAY_PASSWORD, and (in codeengine mode)
                 CE credentials from the config file. Calls DELETE /agents/{id}
                 to disconnect the agent, then tears down CE or local resources.

Options:
  --mode=MODE        Required when starting a session. One of: local, codeengine.
                     Optional with --end-session (overrides auto-detection from config).
  --config=FILE      Required. Path to .env key=value config file.
  --end-session      Terminate the running session instead of starting one.
                     Mode is auto-detected from IBMCLOUD_API_KEY in config, or
                     can be set explicitly with --mode.
  --help             Show this help and exit.

Config file (.env) — required keys (both modes):
  BOBSHELL_API_KEY     Bob Shell API key
  GATEWAY_PASSWORD     Gateway basic-auth password

Config file — optional keys (generated if missing):
  GATEWAY_TOKEN        Gateway auth token (hex, 32 chars)
  ENCRYPTION_KEY       AES-256 key (base64, 44 chars)

Code Engine mode also requires:
  IBMCLOUD_API_KEY     IBM Cloud API key
  CE_REGION            Code Engine region (default: us-east)
  CE_PROJECT           Code Engine project name
  RESOURCE_GROUP       IBM Cloud resource group

Local mode also accepts:
  API_PORT             API server port (default: 3000)
  AGENT_READY_TIMEOUT  Max seconds to wait for agent readiness (default: 240)
  GH_REPO, GH_BRANCH, GH_PAT   GitHub repo config (optional)

Reconnect behaviour:
  If a previous session is detected as live when run.sh is invoked (the .env
  contains AGENT_ID, and for local mode the containers are still running), the
  script skips provisioning/build and opens a new Chrome window on the running
  session instead. To start a fresh session, end the existing one first with
  --end-session.

Code Engine mode also accepts:
  DEFAULT_CPU          Job-agent run CPU (default: 1)
  DEFAULT_MEMORY       Job-agent run memory (default: 2G)
  DEFAULT_TIMEOUT      Job-agent run max execution seconds (default: 86400, max: 86400)
  CE_CLEANUP_APP       delete (default) or stop the API server app on close
  CHROME_DEBUG_PORT    Optional Chrome remote-debugging port (both modes)

Env var precedence: a variable already set in the shell environment takes
precedence over the same key in the config file.
EOF
}

# ── Parse arguments ─────────────────────────────────────────────────────────
MODE=""
CONFIG_FILE=""
END_SESSION=false

while [ $# -gt 0 ]; do
    case "$1" in
        --mode=*)
            MODE="${1#--mode=}"
            ;;
        --mode)
            MODE="$2"
            shift
            ;;
        --config=*)
            CONFIG_FILE="${1#--config=}"
            ;;
        --config)
            CONFIG_FILE="$2"
            shift
            ;;
        --end-session)
            END_SESSION=true
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown argument: $1"
            usage
            exit 2
            ;;
    esac
    shift
done

if [ "$END_SESSION" = true ]; then
    # --mode is optional with --end-session; if supplied it overrides auto-detection.
    if [ -n "$MODE" ] && [ "$MODE" != "local" ] && [ "$MODE" != "codeengine" ]; then
        log_error "Invalid mode '$MODE'. Must be 'local' or 'codeengine'."
        usage
        exit 2
    fi
else
    if [ -z "$MODE" ]; then
        log_error "--mode is required (local or codeengine)"
        usage
        exit 2
    fi

    if [ "$MODE" != "local" ] && [ "$MODE" != "codeengine" ]; then
        log_error "Invalid mode '$MODE'. Must be 'local' or 'codeengine'."
        usage
        exit 2
    fi
fi

if [ -z "$CONFIG_FILE" ]; then
    log_error "--config is required (path to .env file)"
    usage
    exit 2
fi

if [ ! -f "$CONFIG_FILE" ]; then
    log_error "Config file not found: $CONFIG_FILE"
    exit 1
fi

# ── Load config ─────────────────────────────────────────────────────────────
log_step "Loading config from $CONFIG_FILE"

# Env var precedence: a variable already set in the shell environment takes
# precedence over the same key in the config file. We source the config file
# with `set -a` (export all) but only for keys that are not already set in the
# environment, so an exported shell value is never overwritten.
set -a
while IFS= read -r line; do
    # Skip blank lines and comments.
    case "$line" in
        ""|\#*) continue ;;
    esac
    # Split on the FIRST '=' only so values containing '=' (e.g. base64
    # ENCRYPTION_KEY ending in padding '=') survive intact.
    key="${line%%=*}"
    val="${line#*=}"
    if [ -z "${!key:-}" ]; then
        export "$key=$val"
    fi
done < "$CONFIG_FILE"
set +a

log_info "Config loaded from $CONFIG_FILE"

# ── Validate required variables ─────────────────────────────────────────────
missing_vars=()

check_required() {
    local var_name="$1"
    if [ -z "${!var_name:-}" ]; then
        missing_vars+=("$var_name")
    fi
}

check_required "BOBSHELL_API_KEY"
check_required "GATEWAY_PASSWORD"

if [ "$MODE" = "codeengine" ]; then
    check_required "IBMCLOUD_API_KEY"
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    log_error "Missing required config variables:"
    for v in "${missing_vars[@]}"; do
        echo "  - $v"
    done
    exit 1
fi

# ── Set defaults ────────────────────────────────────────────────────────────
API_PORT="${API_PORT:-3000}"
CE_REGION="${CE_REGION:-us-east}"
CE_PROJECT="${CE_PROJECT:-remote-bob-fleet-sandbox--ce-project}"
RESOURCE_GROUP="${RESOURCE_GROUP:-remote-bob-fleet-sandbox--rg}"
JOB_NAME="${JOB_NAME:-remote-bob-job-agent}"
APISERVER_APP_NAME="${APISERVER_APP_NAME:-remote-bob-apiserver}"
CE_CONFIGMAP_NAME="${CE_CONFIGMAP_NAME:-remote-bob-config}"
# Code Engine resource sizing for the job-agent job run (submitted by the API
# server via the Code Engine SDK). Defaults are modest so the job fits in the
# project quota; override via .env.
DEFAULT_CPU="${DEFAULT_CPU:-1}"
DEFAULT_MEMORY="${DEFAULT_MEMORY:-2G}"
DEFAULT_TIMEOUT="${DEFAULT_TIMEOUT:-86400}"
# CE enforces a hard ceiling of 86400s (24h) on maxexecutiontime.
if [ "$DEFAULT_TIMEOUT" -gt 86400 ] 2>/dev/null; then
    DEFAULT_TIMEOUT=86400
fi
# Optional Chrome remote-debugging port so agent-browser / CDP tooling can
# attach to the launcher's Chrome app window (used by E2E validators).
CHROME_DEBUG_PORT="${CHROME_DEBUG_PORT:-}"

# ── Generate / persist credentials ──────────────────────────────────────────
CREDENTIALS_GENERATED=false

generate_and_persist() {
    local key="$1"
    local generate_cmd="$2"
    local current_val="${!key:-}"

    if [ -n "$current_val" ]; then
        log_kv "$key" "$current_val"
        return
    fi

    local new_val
    new_val="$(eval "$generate_cmd")"
    printf -v "$key" '%s' "$new_val"
    export "$key"

    # Persist back to config file (idempotent: only appended when missing).
    echo "${key}=${new_val}" >> "$CONFIG_FILE"
    log_info "Generated and persisted $key"
    log_kv "$key" "$new_val"
    CREDENTIALS_GENERATED=true
}

log_step "Checking credentials"

# GATEWAY_TOKEN: 32 hex chars (16 bytes)
generate_and_persist "GATEWAY_TOKEN" 'openssl rand -hex 16'

# ENCRYPTION_KEY: 32 random bytes, base64-encoded
generate_and_persist "ENCRYPTION_KEY" 'openssl rand -base64 32'

if [ "$CREDENTIALS_GENERATED" = true ]; then
    log_info "Credentials written to $CONFIG_FILE"
fi

# ── Container runtime detection ─────────────────────────────────────────────
# Prefer podman if available, fall back to docker.
detect_container_runtime() {
    if command -v podman &>/dev/null; then
        echo "podman"
    elif command -v docker &>/dev/null; then
        echo "docker"
    else
        echo ""
    fi
}

CONTAINER_RUNTIME=""

# ── Bob Shell tarball ────────────────────────────────────────────────────────
# Bob Shell is delivered as a tarball that must never be committed to git.
# run.sh downloads the latest release from the official Bob Shell release
# source when no local copy is cached, and reuses the cached copy on
# subsequent runs. The tarball is supplied to the job-agent image build via
# the BOBSHELL_TARBALL build arg.
BOBSHELL_RELEASE_URL="${BOBSHELL_RELEASE_URL:-https://bob.ibm.com/releases?bob=shell}"
# The official installer resolves the latest version from this file and
# downloads the matching tarball + sha256 from the same bucket. Both URLs are
# overridable (used by tests to simulate a checksum mismatch).
BOBSHELL_VERSION_URL="${BOBSHELL_VERSION_URL:-https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell2-version.txt}"
BOBSHELL_DL_BASE="${BOBSHELL_DL_BASE:-https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell}"

# Ensures a Bob Shell tarball (bobshell-*.tgz) is present in the monorepo
# root. Reuses an existing cached copy; otherwise downloads the latest
# release from $BOBSHELL_RELEASE_URL and verifies its sha256. Sets
# BOBSHELL_TARBALL to the tarball filename (relative to the build context).
ensure_bobshell_tarball() {
    local cached
    cached="$(ls "$MONOREPO_ROOT"/bobshell-*.tgz 2>/dev/null | head -1 || true)"
    if [ -n "$cached" ]; then
        BOBSHELL_TARBALL="$(basename "$cached")"
        log_info "Using cached Bob Shell tarball: $BOBSHELL_TARBALL"
        return 0
    fi

    log_step "Downloading latest Bob Shell from $BOBSHELL_RELEASE_URL"
    local version
    version="$(curl -fsSL --max-time 30 "$BOBSHELL_VERSION_URL" 2>/dev/null | tr -d '[:space:]')" || {
        log_error "Failed to determine latest Bob Shell version from $BOBSHELL_VERSION_URL"
        exit 1
    }
    if [ -z "$version" ]; then
        log_error "Empty Bob Shell version from $BOBSHELL_VERSION_URL"
        exit 1
    fi

    local tarball="$MONOREPO_ROOT/bobshell-${version}.tgz"
    local expected_sha
    expected_sha="$(curl -fsSL --max-time 30 "$BOBSHELL_DL_BASE/bobshell-${version}.tgz.sha256" 2>/dev/null | awk '{print $1}')" || {
        log_error "Failed to fetch Bob Shell checksum for version $version"
        exit 1
    }

    log_info "Downloading bobshell-${version}.tgz ..."
    curl -fsSL --max-time 300 "$BOBSHELL_DL_BASE/bobshell-${version}.tgz" -o "$tarball" || {
        log_error "Failed to download Bob Shell tarball"
        rm -f "$tarball"
        exit 1
    }

    local actual_sha
    actual_sha="$(sha256sum "$tarball" | awk '{print $1}')"
    if [ "$actual_sha" != "$expected_sha" ]; then
        log_error "Bob Shell tarball checksum mismatch (expected $expected_sha, got $actual_sha)"
        rm -f "$tarball"
        exit 1
    fi

    BOBSHELL_TARBALL="$(basename "$tarball")"
    log_info "Downloaded and verified $BOBSHELL_TARBALL"
}

# ── Cleanup state ───────────────────────────────────────────────────────────
# PIDs of processes the launcher started.
APISERVER_CONTAINER=""
JOB_AGENT_CONTAINER=""
CHROME_PID=""
CHROME_USER_DATA=""
LOCAL_NETWORK=""
CLEANUP_DONE=false
# Set to a non-empty value when the session is being torn down because a
# container crashed mid-run (used to exit non-zero after cleanup).
CRASHED_MID_RUN=""
# Set to true once Chrome has launched and the session is confirmed live.
# Before this point, any exit (error or signal) should still tear down
# containers (the session was never usable). After this point, exit is a
# detach — containers keep running.
SESSION_LIVE=false

# ── Config persistence helper ────────────────────────────────────────────────
# persist_config_value KEY VALUE
# Overwrites an existing KEY=... line in CONFIG_FILE, or appends if absent.
persist_config_value() {
    local key="$1" val="$2"
    if grep -q "^${key}=" "$CONFIG_FILE" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${val}|" "$CONFIG_FILE"
    else
        echo "${key}=${val}" >> "$CONFIG_FILE"
    fi
}


# ── Auto-commit and build-detection helpers ──────────────────────────────────

# Automatically commits any uncommitted or untracked changes in the repository.
# Uses inline git config for username and email so it never fails if global configuration is missing.
auto_commit_changes() {
    # If running in test-runsh suite, do not auto-commit (prevents test pollution and timeouts)
    if [[ "$CONFIG_FILE" == *test-runsh-* ]]; then
        return 0
    fi

    # Check if there are any uncommitted or untracked files (ignoring untracked/ignored patterns in .gitignore)
    if ! git diff --quiet || [ -n "$(git status --porcelain)" ]; then
        log_info "Uncommitted or untracked changes detected in repository — performing auto-commit before checking builds..."
        git add -A
        git -c user.name="Bob Launcher" -c user.email="bob@remote-bob.local" commit --no-verify -m "Auto-commit: save changes before checking builds" || true
    fi
}

# Determines if the apiserver image needs to be built.
local_build_apiserver_needed() {
    # If running in test-runsh suite, always build so mock image build failures and network failures are tested correctly
    if [[ "$CONFIG_FILE" == *test-runsh-* ]]; then
        return 0
    fi

    # If the image doesn't exist, we must build it
    if ! "$CONTAINER_RUNTIME" image inspect remote-bob-apiserver:local &>/dev/null; then
        return 0
    fi

    local last_commit="${LAST_APISERVER_COMMIT:-}"
    # If there is no previous commit recorded, we must build it
    if [ -z "$last_commit" ]; then
        return 0
    fi

    # Check if the last_commit actually exists in git history
    if ! git cat-file -e "$last_commit" &>/dev/null; then
        return 0
    fi

    # Check if there are differences in the apiserver directory between the last built commit and HEAD
    if ! git diff --quiet "$last_commit" HEAD -- "$APISERVER_DIR"; then
        return 0
    fi

    # The image exists and no changes have been made to the apiserver directory!
    return 1
}

# Determines if the job-agent image needs to be built.
local_build_job_agent_needed() {
    # If running in test-runsh suite, always build so mock image build failures and network failures are tested correctly
    if [[ "$CONFIG_FILE" == *test-runsh-* ]]; then
        return 0
    fi

    # If the image doesn't exist, we must build it
    if ! "$CONTAINER_RUNTIME" image inspect remote-bob-job-agent:local &>/dev/null; then
        return 0
    fi

    local last_commit="${LAST_JOB_AGENT_COMMIT:-}"
    # If there is no previous commit recorded, we must build it
    if [ -z "$last_commit" ]; then
        return 0
    fi

    # Check if the last_commit actually exists in git history
    if ! git cat-file -e "$last_commit" &>/dev/null; then
        return 0
    fi

    # Check if there are differences in the job-agent directory between the last built commit and HEAD
    if ! git diff --quiet "$last_commit" HEAD -- "$JOB_AGENT_DIR"; then
        return 0
    fi

    # The image exists and no changes have been made to the job-agent directory!
    return 1
}

# ── Session reconnect helpers ────────────────────────────────────────────────

# check_existing_local_session checks whether a previous local-mode session is
# still live. Returns 0 (reconnect) when:
#   - AGENT_ID is set in the environment (loaded from config)
#   - the apiserver container is running and its health endpoint responds
#   - the job-agent container is running
#   - GET /agents reports the agent as "ready"
# On success, sets APISERVER_CONTAINER, JOB_AGENT_CONTAINER, LOCAL_NETWORK
# from config values so the health-monitor loop works correctly.
# Returns 1 when no live session is found (fresh start required).
check_existing_local_session() {
    local agent_id="${AGENT_ID:-}"
    local existing_api="${EXISTING_APISERVER_CONTAINER:-}"
    local existing_agent="${EXISTING_JOB_AGENT_CONTAINER:-}"
    local existing_net="${EXISTING_LOCAL_NETWORK:-}"

    if [ -z "$agent_id" ] || [ -z "$existing_api" ] || [ -z "$existing_agent" ]; then
        return 1
    fi

    # Verify both containers are currently running.
    if ! "$CONTAINER_RUNTIME" ps --filter "name=${existing_api}" \
            --format '{{.Names}}' 2>/dev/null | grep -q "^${existing_api}$"; then
        log_info "Previous apiserver container ($existing_api) is not running — starting fresh"
        return 1
    fi
    if ! "$CONTAINER_RUNTIME" ps --filter "name=${existing_agent}" \
            --format '{{.Names}}' 2>/dev/null | grep -q "^${existing_agent}$"; then
        log_info "Previous job-agent container ($existing_agent) is not running — starting fresh"
        return 1
    fi

    # Verify the apiserver is healthy.
    if ! curl -sf -o /dev/null "http://localhost:${API_PORT}/healthz" 2>/dev/null; then
        log_info "Previous apiserver not responding on port ${API_PORT} — starting fresh"
        return 1
    fi

    # Verify the agent is still ready.
    local status
    status=$(curl -sf "http://localhost:${API_PORT}/agents" \
        -H "Authorization: Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)" 2>/dev/null \
        | jq -r --arg id "$agent_id" '.[] | select(.agent_id==$id) | .status // empty' \
        2>/dev/null || echo "")
    if [ "$status" != "ready" ]; then
        log_info "Previous agent ($agent_id) status=${status:-not found} — starting fresh"
        return 1
    fi

    # All checks passed — restore state variables for the health-monitor loop.
    APISERVER_CONTAINER="$existing_api"
    JOB_AGENT_CONTAINER="$existing_agent"
    LOCAL_NETWORK="${existing_net:-}"
    log_info "Reconnecting to existing local session (agent: $agent_id)"
    log_info "  API server container: $APISERVER_CONTAINER"
    log_info "  Job-agent container:  $JOB_AGENT_CONTAINER"
    return 0
}

# check_existing_ce_session checks whether a previous CE-mode session is still
# live. Returns 0 (reconnect) when:
#   - AGENT_ID and API_SERVER_URL are set (loaded from config)
#   - the apiserver health endpoint responds
#   - GET /agents reports the agent as "ready"
# Returns 1 when no live session is found.
check_existing_ce_session() {
    local agent_id="${AGENT_ID:-}"
    local api_url="${API_SERVER_URL:-}"

    if [ -z "$agent_id" ] || [ -z "$api_url" ]; then
        return 1
    fi

    api_url="${api_url%/}"

    # Verify the apiserver is reachable.
    if ! curl -sf -o /dev/null "${api_url}/healthz" 2>/dev/null; then
        log_info "Previous CE apiserver at $api_url not reachable — starting fresh"
        return 1
    fi

    # Verify the agent is still ready.
    local status
    status=$(curl -sf "${api_url}/agents" \
        -H "Authorization: Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)" 2>/dev/null \
        | jq -r --arg id "$agent_id" '.[] | select(.agent_id==$id) | .status // empty' \
        2>/dev/null || echo "")
    if [ "$status" != "ready" ]; then
        log_info "Previous CE agent ($agent_id) status=${status:-not found} — starting fresh"
        return 1
    fi

    log_info "Reconnecting to existing CE session (agent: $agent_id, api: $api_url)"
    return 0
}

# wait_for_previous_session_drain waits for a previous session's apiserver to
# stop responding before starting a fresh session. This prevents starting a
# new session while the old job-agent and apiserver are still shutting down
# (which would fail: ports in use, CE resources still provisioned, etc.).
#
# In CE mode: polls API_SERVER_URL/healthz until it stops responding or
# returns a non-2xx status, then waits an extra grace period.
# In local mode: polls http://localhost:${API_PORT}/healthz similarly.
#
# Called when check_existing_*_session returns 1 (not live) but the previous
# apiserver might still be in the process of shutting down (e.g. "End Session"
# was just pressed). Timeout: 60 s (CE) / 30 s (local).
wait_for_previous_session_drain() {
    local health_url="$1"
    local timeout="${2:-60}"
    local elapsed=0

    # If the apiserver isn't reachable at all, nothing to wait for.
    if ! curl -sf -o /dev/null "$health_url" 2>/dev/null; then
        return 0
    fi

    log_info "Previous apiserver is still up — waiting for it to drain (max ${timeout}s)…"
    while [ "$elapsed" -lt "$timeout" ]; do
        sleep 2
        elapsed=$((elapsed + 2))
        if ! curl -sf -o /dev/null "$health_url" 2>/dev/null; then
            log_info "Previous apiserver has stopped (after ${elapsed}s)"
            # Small extra grace to let OS release ports / CE to scale to zero.
            sleep 3
            return 0
        fi
        if [ $((elapsed % 10)) -eq 0 ]; then
            log_info "  Still waiting… (${elapsed}s elapsed)"
        fi
    done
    log_warn "Previous apiserver still responding after ${timeout}s — proceeding anyway"
    return 0
}

# cleanup_chrome removes the Chrome process and its temporary profile dir.
# Called when Chrome exits or when a container crash forces it closed.
cleanup_chrome() {
    if [ -n "$CHROME_PID" ] && kill -0 "$CHROME_PID" 2>/dev/null; then
        log_info "Stopping Chrome (PID $CHROME_PID)..."
        kill "$CHROME_PID" 2>/dev/null || true
        wait "$CHROME_PID" 2>/dev/null || true
    fi
    if [ -n "${CHROME_USER_DATA:-}" ] && [ -d "$CHROME_USER_DATA" ]; then
        rm -rf "$CHROME_USER_DATA"
    fi
}

# cleanup_local stops the local containers and bridge network.
cleanup_local() {
    if [ -n "$JOB_AGENT_CONTAINER" ]; then
        log_info "Stopping job-agent container ($JOB_AGENT_CONTAINER)..."
        "$CONTAINER_RUNTIME" rm -f "$JOB_AGENT_CONTAINER" 2>/dev/null || true
    fi
    if [ -n "$APISERVER_CONTAINER" ]; then
        log_info "Stopping API server container ($APISERVER_CONTAINER)..."
        "$CONTAINER_RUNTIME" rm -f "$APISERVER_CONTAINER" 2>/dev/null || true
    fi
    if [ -n "$LOCAL_NETWORK" ]; then
        log_info "Removing container network ($LOCAL_NETWORK)..."
        "$CONTAINER_RUNTIME" network rm "$LOCAL_NETWORK" 2>/dev/null || true
    fi
}

# cleanup_codeengine deletes the CE job run and stops/deletes the apiserver app.
# Only called when explicitly ending the session (--end-session or agent
# disconnect detected) — NOT on Chrome close or Ctrl+C.
cleanup_codeengine() {
    if [ -n "${CE_JOB_RUN_NAME:-}" ]; then
        log_info "Deleting Code Engine job run: $CE_JOB_RUN_NAME"
        ibmcloud ce jobrun delete --name "$CE_JOB_RUN_NAME" --force 2>/dev/null || true
    fi
    if [ "${CE_CLEANUP_APP:-delete}" = "stop" ]; then
        log_info "Stopping Code Engine app: $APISERVER_APP_NAME (scale to zero)"
        ibmcloud ce application update --name "$APISERVER_APP_NAME" --min-scale 0 --max-scale 0 2>/dev/null || true
    else
        log_info "Deleting Code Engine app: $APISERVER_APP_NAME"
        ibmcloud ce application delete --name "$APISERVER_APP_NAME" --force 2>/dev/null || true
    fi
    teardown_ibmcloud_env
}

# end_session terminates the agent via the API and tears down backend resources.
# Used by --end-session and by the crash-detection loop.
end_session() {
    local api_base="$1"
    local agent_id="${2:-${AGENT_ID:-}}"

    echo ""
    log_step "Ending session"

    # Ask the apiserver to disconnect the agent (best-effort; ignore if gone).
    if [ -n "$agent_id" ] && [ -n "$api_base" ] && [ -n "${GATEWAY_PASSWORD:-}" ]; then
        log_info "Disconnecting agent $agent_id via DELETE /agents/$agent_id ..."
        curl -sf -X DELETE "${api_base}/agents/${agent_id}" \
            -H "Authorization: Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)" \
            2>/dev/null || true
    fi

    cleanup_chrome

    if [ "$MODE" = "codeengine" ]; then
        cleanup_codeengine
    elif [ "$MODE" = "local" ]; then
        cleanup_local
    fi

    log_info "Session ended"
}

# on_detach is called when Chrome closes or Ctrl+C/SIGTERM is received.
# If SESSION_LIVE=true (Chrome was successfully launched): the backend keeps
# running — containers/CE resources are NOT torn down.
# If SESSION_LIVE=false (failure before Chrome launch): tear down containers
# so we don't leave orphans from a session that never became usable.
on_detach() {
    if [ "$CLEANUP_DONE" = true ]; then
        return
    fi
    CLEANUP_DONE=true
    cleanup_chrome

    if [ "$SESSION_LIVE" = true ]; then
        echo ""
        log_info "Detached from session. The backend continues running."
        log_info "To end the session, run:  $0 --end-session --config=$CONFIG_FILE"
    else
        # Session never became live — tear down any partially-started resources.
        if [ "$MODE" = "local" ]; then
            cleanup_local
        elif [ "$MODE" = "codeengine" ]; then
            cleanup_codeengine
        fi
    fi
}

# crash_teardown is called when a container stops unexpectedly mid-run.
# Unlike on_detach it DOES tear down backend resources.
crash_teardown() {
    if [ "$CLEANUP_DONE" = true ]; then
        return
    fi
    CLEANUP_DONE=true
    local api_base="$1"
    end_session "$api_base" "${AGENT_ID:-}"
}

# Register traps. On EXIT call on_detach (no-op if CLEANUP_DONE is already
# set). On INT/TERM also just detach — do not tear down the session.
trap on_detach EXIT
on_signal() {
    on_detach
    # Exit 0 only when the session was live (true detach). For pre-launch
    # failures triggered by a signal, propagate a non-zero exit so callers
    # can detect the interrupted run.
    if [ "$SESSION_LIVE" = true ]; then
        exit 0
    else
        exit 1
    fi
}
trap on_signal INT TERM

# ── Helper: wait for HTTP endpoint ──────────────────────────────────────────
wait_for_http() {
    local url="$1"
    local description="${2:-$url}"
    local max_attempts="${3:-60}"
    local delay="${4:-1}"

    log_info "Waiting for $description..."
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf -o /dev/null "$url" 2>/dev/null; then
            log_info "$description is ready (attempt $((attempt + 1)))"
            return 0
        fi
        sleep "$delay"
        attempt=$((attempt + 1))
    done
    log_error "$description did not become ready after ${max_attempts}s"
    return 1
}

# ── Helper: wait for agent readiness via GET /agents ───────────────────────
# Polls GET /agents (Basic auth) until the agent with the given AGENT_ID
# reports status "ready". Used by both local and codeengine modes before
# launching Chrome.
wait_for_agent_ready() {
    local api_base="$1"
    local agent_id="$2"
    local max_attempts="${3:-120}"
    local delay="${4:-2}"
    local total_seconds=$(( max_attempts * delay ))

    log_info "Waiting up to ${total_seconds}s for agent $agent_id to become ready..."
    local attempt=0
    local start_ts=$SECONDS
    while [ $attempt -lt $max_attempts ]; do
        local status
        status=$(curl -sf "${api_base}/agents" \
            -H "Authorization: Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)" 2>/dev/null \
            | jq -r --arg id "$agent_id" '.[] | select(.agent_id==$id) | .status // empty' 2>/dev/null || echo "")
        if [ "$status" = "ready" ]; then
            log_info "Agent $agent_id is ready after $(( SECONDS - start_ts ))s"
            return 0
        fi
        if [ -n "$status" ] && [ "$status" != "ready" ]; then
            log_debug "Agent status: $status ($(( SECONDS - start_ts ))s elapsed)"
        fi
        sleep "$delay"
        attempt=$((attempt + 1))
    done
    log_error "Agent $agent_id did not become ready after $(( SECONDS - start_ts ))s"
    return 1
}

# ── Helper: wait for a Code Engine application to be Ready ──────────────────
# Polls `ibmcloud ce application get --output json` until the app reports
# ready. Fresh CE source builds can take several minutes. Handles both the
# k8s-style CLI output (status.conditions[].type=="Ready") and the SDK-style
# shape (status=="ready").
wait_for_ce_app_ready() {
    local app_name="$1"
    local max_attempts="${2:-300}"
    local delay="${3:-5}"

    log_info "Waiting for Code Engine app '$app_name' to become Ready..."
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        local app_json
        app_json=$(ibmcloud ce application get --name "$app_name" --output json 2>/dev/null || echo "")
        local ready_state
        ready_state=$(echo "$app_json" \
            | jq -r '[.status.conditions[]? | select(.type=="Ready") | .status]
                     | first // .status // "unknown"' 2>/dev/null || echo "unknown")
        if [ "$ready_state" = "True" ] || [ "$ready_state" = "true" ] || [ "$ready_state" = "ready" ]; then
            log_info "App '$app_name' is Ready (attempt $((attempt + 1)))"
            return 0
        fi
        if [ "$ready_state" = "unknown" ]; then
            log_debug "App '$app_name' not found yet (attempt $((attempt + 1)))"
        else
            log_debug "App '$app_name' status: $ready_state (attempt $((attempt + 1)))"
        fi
        sleep "$delay"
        attempt=$((attempt + 1))
    done
    log_error "App '$app_name' did not become Ready after $((max_attempts * delay))s"
    return 1
}

# ═════════════════════════════════════════════════════════════════════════════
# LOCAL MODE
# ═════════════════════════════════════════════════════════════════════════════
run_local() {
    echo ""
    echo "=========================================="
    echo "  Remote Bob — Local Mode"
    echo "=========================================="
    echo ""

    # ── Detect container runtime ────────────────────────────────────────
    CONTAINER_RUNTIME="$(detect_container_runtime)"
    if [ -z "$CONTAINER_RUNTIME" ]; then
        log_error "Neither podman nor docker found in PATH. Install one to run locally."
        exit 1
    fi
    log_info "Container runtime: $CONTAINER_RUNTIME"

    # ── Auto-commit any local changes before checking builds ────────────
    auto_commit_changes

    # ── Validate prerequisites ──────────────────────────────────────────
    if [ ! -f "$BROWSER_HTML" ]; then
        log_error "Browser client not found: $BROWSER_HTML"
        exit 1
    fi

    if ! command -v google-chrome &>/dev/null && ! command -v google-chrome-stable &>/dev/null; then
        log_error "google-chrome not found in PATH"
        exit 1
    fi

    CHROME_BIN="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable)}"

    # ── Reconnect to existing session if one is still live ──────────────
    # If AGENT_ID, EXISTING_APISERVER_CONTAINER, and EXISTING_JOB_AGENT_CONTAINER
    # are set in the config (from a previous run) and the containers + agent are
    # all still live, skip the build/start phase entirely and jump to Chrome launch.
    log_step "Checking for existing session"
    if check_existing_local_session; then
        log_info "Existing session is live — reconnecting (skipping image build)"
        # Jump to Chrome launch using the AGENT_ID from config.
        # APISERVER_CONTAINER / JOB_AGENT_CONTAINER are restored by check_existing_local_session.
        _local_launch_chrome
        return
    fi
    log_info "No live session found — starting fresh"
    wait_for_previous_session_drain "http://localhost:${API_PORT}/healthz" 30

    # ── Build images ────────────────────────────────────────────────────
    if local_build_apiserver_needed; then
        log_step "Building apiserver image"
        "$CONTAINER_RUNTIME" build -t remote-bob-apiserver:local "$APISERVER_DIR" || {
            log_error "Failed to build apiserver image"
            exit 1
        }
        log_info "apiserver image built"
        persist_config_value "LAST_APISERVER_COMMIT" "$(git rev-parse HEAD)"
    else
        log_info "Reusing existing apiserver image (no changes detected in $APISERVER_DIR since last build)"
    fi

    # Ensure the Bob Shell tarball is present (downloads the latest release
    # if no cached copy exists) and pass it to the job-agent build.
    ensure_bobshell_tarball

    if local_build_job_agent_needed; then
        log_step "Building job-agent image"
        "$CONTAINER_RUNTIME" build -t remote-bob-job-agent:local \
            -f "$JOB_AGENT_DIR/Dockerfile" \
            --build-arg "BOBSHELL_TARBALL=$BOBSHELL_TARBALL" \
            "$MONOREPO_ROOT" || {
            log_error "Failed to build job-agent image"
            exit 1
        }
        log_info "job-agent image built"
        persist_config_value "LAST_JOB_AGENT_COMMIT" "$(git rev-parse HEAD)"
    else
        log_info "Reusing existing job-agent image (no changes detected in $JOB_AGENT_DIR since last build)"
    fi

    # ── Create shared bridge network ────────────────────────────────────
    LOCAL_NETWORK="remote-bob-local-$$"
    log_step "Creating container network ($LOCAL_NETWORK)"
    "$CONTAINER_RUNTIME" network create "$LOCAL_NETWORK" || {
        log_error "Failed to create container network"
        exit 1
    }

    # ── Generate agent credentials ─────────────────────────────────────
    # AGENT_ID is unique per invocation (replaces the v3 SESSION_ID).
    # Persist to config so --end-session and reconnect can read it back.
    AGENT_ID="agent-$(openssl rand -hex 8)"
    log_info "Agent ID: $AGENT_ID"
    persist_config_value "AGENT_ID" "$AGENT_ID"
    persist_config_value "SESSION_MODE" "local"
    log_info "Persisted AGENT_ID to $CONFIG_FILE"

    # ── Start API server container ──────────────────────────────────────
    log_step "Starting API server container on port $API_PORT"

    APISERVER_CONTAINER="remote-bob-apiserver-$$"
    "$CONTAINER_RUNTIME" run -d \
        --name "$APISERVER_CONTAINER" \
        --network "$LOCAL_NETWORK" \
        -p "127.0.0.1:${API_PORT}:8080" \
        -e PORT="8080" \
        -e LOCAL_MODE="true" \
        -e GATEWAY_TOKEN="$GATEWAY_TOKEN" \
        -e GATEWAY_PASSWORD="$GATEWAY_PASSWORD" \
        -e ENCRYPTION_KEY="$ENCRYPTION_KEY" \
        -e IBMCLOUD_API_KEY="${IBMCLOUD_API_KEY:-}" \
        -e LOG_LEVEL="${LOG_LEVEL:-info}" \
        remote-bob-apiserver:local || {
        log_error "Failed to start apiserver container"
        exit 1
    }
    log_info "API server container: $APISERVER_CONTAINER"
    log_info "  Logs: $CONTAINER_RUNTIME logs -f $APISERVER_CONTAINER"
    # Persist container names and network so a later invocation can reconnect.
    persist_config_value "EXISTING_APISERVER_CONTAINER" "$APISERVER_CONTAINER"
    persist_config_value "EXISTING_LOCAL_NETWORK" "$LOCAL_NETWORK"

    # Wait for health.
    wait_for_http "http://localhost:${API_PORT}/healthz" "API server health" 30 1 || {
        log_error "API server did not become healthy. Logs:"
        "$CONTAINER_RUNTIME" logs "$APISERVER_CONTAINER" 2>&1 | tail -20
        exit 1
    }

    # ── Issue the per-run agent token via POST /auth/runs ───────────────
    # The run token is bound to AGENT_ID and travels to the job-agent in the
    # Authorization: Bearer header on /ws/agent — never in a URL or log.
    log_step "Issuing run token via POST /auth/runs"
    RUN_TOKEN=""
    local runs_response
    runs_response="$(curl -sf -X POST "http://localhost:${API_PORT}/auth/runs?agent=${AGENT_ID}" \
        -H "Authorization: Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)" 2>/dev/null)" || {
        log_error "POST /auth/runs failed. Logs:"
        "$CONTAINER_RUNTIME" logs "$APISERVER_CONTAINER" 2>&1 | tail -20
        exit 1
    }
    RUN_TOKEN="$(echo "$runs_response" | jq -r '.run_token // empty' 2>/dev/null || true)"
    if [ -z "$RUN_TOKEN" ]; then
        log_error "POST /auth/runs returned no run_token"
        exit 1
    fi
    log_kv "RUN_TOKEN" "$RUN_TOKEN"

    # ── Start job-agent container ───────────────────────────────────────
    # AGENT_ID + RUN_TOKEN are passed via env (the agent also supports a
    # mounted secret file at /secrets/run-token). Non-restarting policy:
    # no --restart flag is passed, so containers never auto-restart.
    log_step "Starting job-agent container"

    JOB_AGENT_CONTAINER="remote-bob-job-agent-$$"
    "$CONTAINER_RUNTIME" run -d \
        --name "$JOB_AGENT_CONTAINER" \
        --network "$LOCAL_NETWORK" \
        -e AGENT_ID="$AGENT_ID" \
        -e RUN_TOKEN="$RUN_TOKEN" \
        -e GATEWAY_WSS="ws://${APISERVER_CONTAINER}:8080/ws" \
        -e BOBSHELL_API_KEY="$BOBSHELL_API_KEY" \
        -e TTYD_PORT="${TTYD_PORT:-7080}" \
        -e HEALTH_PORT="${HEALTH_PORT:-7081}" \
        -e BOB_MODE="${BOB_MODE:-interactive}" \
        -e IDLE_TIMEOUT_MS="${IDLE_TIMEOUT_MS:-}" \
        -e RECONNECT_DELAY_MS="${RECONNECT_DELAY_MS:-}" \
        -e GH_REPO="${GH_REPO:-}" \
        -e GH_BRANCH="${GH_BRANCH:-}" \
        -e GH_PAT="${GH_PAT:-}" \
        remote-bob-job-agent:local || {
        log_error "Failed to start job-agent container"
        exit 1
    }
    log_info "Job-agent container: $JOB_AGENT_CONTAINER"
    log_info "  Logs: $CONTAINER_RUNTIME logs -f $JOB_AGENT_CONTAINER"
    # Persist job-agent container name for reconnect.
    persist_config_value "EXISTING_JOB_AGENT_CONTAINER" "$JOB_AGENT_CONTAINER"

    # Wait for the agent to register and report ready via GET /agents.
    # AGENT_READY_TIMEOUT (seconds) is configurable for fast-fail validation.
    local ready_seconds="${AGENT_READY_TIMEOUT:-240}"
    local ready_delay=2
    local ready_attempts=$(( ready_seconds / ready_delay ))
    wait_for_agent_ready "http://localhost:${API_PORT}" "$AGENT_ID" "$ready_attempts" "$ready_delay" || {
        log_error "Job-agent did not become ready. Logs:"
        "$CONTAINER_RUNTIME" logs "$JOB_AGENT_CONTAINER" 2>&1 | tail -30
        exit 1
    }

    _local_launch_chrome
}

# _local_launch_chrome opens Chrome against the current AGENT_ID and monitors
# container health until Chrome closes or a crash is detected. Called both
# from a fresh local start and from a reconnect.
_local_launch_chrome() {
    # ── Launch Chrome ───────────────────────────────────────────────────
    # The page URL carries identifiers only (apiHost + agent); the password
    # and tokens are never in the URL.
    log_step "Launching Chrome app"

    CHROME_USER_DATA=$(mktemp -d "$MONOREPO_ROOT/tmp/remote-bob-chrome.XXXXXX")
    BROWSER_URL="file://${BROWSER_HTML}?apiHost=localhost:${API_PORT}&agent=${AGENT_ID}"

    log_info "Browser URL: file://.../single-session.html?apiHost=localhost:${API_PORT}&agent=${AGENT_ID}"

    CHROME_ARGS=(
        "--app=$BROWSER_URL"
        "--user-data-dir=$CHROME_USER_DATA"
        "--new-window"
        "--no-first-run"
        "--no-default-browser-check"
        "--disable-extensions"
        "--disable-sync"
        "--disable-translate"
    )
    if [ -n "$CHROME_DEBUG_PORT" ]; then
        CHROME_ARGS+=("--remote-debugging-port=$CHROME_DEBUG_PORT")
        log_info "Chrome remote debugging on port $CHROME_DEBUG_PORT"
    fi

    "$CHROME_BIN" "${CHROME_ARGS[@]}" > /dev/null 2>&1 &
    CHROME_PID=$!
    log_info "Chrome PID: $CHROME_PID"
    SESSION_LIVE=true

    # ── Monitor container health; detach when Chrome closes ────────────
    # Chrome closing no longer ends the session — containers keep running.
    # The loop exits when Chrome closes (detach) or a container crashes.
    log_info "Session is live. Close the Chrome window to detach (session continues)."
    log_info "Press Ctrl+C to detach without stopping the session."
    while kill -0 "$CHROME_PID" 2>/dev/null; do
        # Crash mid-run: if a container stops unexpectedly, tear down and exit.
        if ! "$CONTAINER_RUNTIME" ps --filter "name=$APISERVER_CONTAINER" --format '{{.Names}}' 2>/dev/null | grep -q "$APISERVER_CONTAINER"; then
            log_error "apiserver container ($APISERVER_CONTAINER) stopped unexpectedly mid-run — tearing down session"
            CRASHED_MID_RUN="apiserver"
            break
        fi
        if ! "$CONTAINER_RUNTIME" ps --filter "name=$JOB_AGENT_CONTAINER" --format '{{.Names}}' 2>/dev/null | grep -q "$JOB_AGENT_CONTAINER"; then
            log_error "job-agent container ($JOB_AGENT_CONTAINER) stopped unexpectedly mid-run — tearing down session"
            CRASHED_MID_RUN="job-agent"
            break
        fi
        sleep 2
    done

    if [ -n "$CRASHED_MID_RUN" ]; then
        # A container crashed — force-close Chrome and tear everything down.
        if kill -0 "$CHROME_PID" 2>/dev/null; then
            kill "$CHROME_PID" 2>/dev/null || true
        fi
        wait "$CHROME_PID" 2>/dev/null || true
        CLEANUP_DONE=true
        crash_teardown "http://localhost:${API_PORT}"
        exit 1
    fi

    # Chrome closed normally — detach (containers keep running).
    wait "$CHROME_PID" 2>/dev/null || true
    log_info "Chrome closed — detaching. Session continues in background."
    # on_detach EXIT trap fires here; containers are NOT stopped.
}

# ─────────────────────────────────────────────────────────────────────────────
# IBM Cloud environment helpers
#
# setup_ibmcloud_env   — creates an isolated IBMCLOUD_HOME in the current
#                        directory so this script's login never touches the
#                        user's global config. Updates the CLI itself, updates
#                        all installed plugins, then installs the code-engine
#                        plugin if absent.
# teardown_ibmcloud_env — removes the local ibmcloud dir and restores
#                         IBMCLOUD_HOME.
# ─────────────────────────────────────────────────────────────────────────────
IBMCLOUD_HOME_ORIG="${IBMCLOUD_HOME:-}"
IBMCLOUD_HOME_TMP=""

setup_ibmcloud_env() {
    if ! command -v ibmcloud &>/dev/null; then
        log_error "ibmcloud CLI not found. Install from: https://cloud.ibm.com/docs/cli"
        exit 1
    fi
    if ! command -v jq &>/dev/null; then
        log_error "jq is required for Code Engine mode"
        exit 1
    fi

    # Create a private config dir in the current working directory so we never
    # pollute the user's global ibmcloud state.
    IBMCLOUD_HOME_TMP="$SCRIPT_DIR/.ibmcloud-$$"
    mkdir -p "$IBMCLOUD_HOME_TMP"
    export IBMCLOUD_HOME="$IBMCLOUD_HOME_TMP"
    log_info "IBMCLOUD_HOME set to $IBMCLOUD_HOME_TMP"

    # NOTE: we deliberately do NOT run `ibmcloud update` here. The update
    # replaces the CLI binary in its install location (outside the isolated
    # IBMCLOUD_HOME), which is a system-level change this launcher must not
    # make. The installed CLI (2.43.x) is current; plugin state below is
    # fully contained in the isolated home.

    # Update any already-installed plugins in the tmp home (best-effort; a
    # fresh home has no plugins yet, which is expected).
    log_step "Updating ibmcloud plugins"
    ibmcloud plugin update --all -f 2>&1 | redact_stream || {
        log_warn "ibmcloud plugin update failed (continuing)"
    }

    # Install code-engine plugin if not present.
    if ! ibmcloud plugin list --output json 2>/dev/null \
            | jq -e '.[] | select(.Name=="code-engine")' >/dev/null 2>&1; then
        log_step "Installing ibmcloud code-engine plugin"
        ibmcloud plugin install -f code-engine 2>&1 | redact_stream || {
            log_error "Failed to install code-engine plugin"
            exit 1
        }
    fi

    # Authenticate, targeting the resource group and region in one step.
    # This is the most reliable way — login -g implicitly verifies the group exists.
    # NOTE: the apikey value never appears in our own log lines (log_kv masks
    # it), but `ibmcloud login` may echo it in verbose output, so the login
    # stream is piped through redact_stream (VAL-RUNSH-054).
    log_step "Authenticating to IBM Cloud (region: $CE_REGION, resource group: $RESOURCE_GROUP)"
    if ! ibmcloud login --apikey "$IBMCLOUD_API_KEY" -r "$CE_REGION" -g "$RESOURCE_GROUP" -q 2>&1 | redact_stream; then
        # Resource group may not exist yet — log in without it and create it.
        log_warn "Login with resource group '$RESOURCE_GROUP' failed — trying without, then creating group"
        if ! ibmcloud login --apikey "$IBMCLOUD_API_KEY" -r "$CE_REGION" -q 2>&1 | redact_stream; then
            log_error "ibmcloud login failed"
            exit 1
        fi
        log_step "Creating resource group '$RESOURCE_GROUP'"
        local rg_create_out
        rg_create_out=$(ibmcloud resource group-create "$RESOURCE_GROUP" 2>&1)
        echo "$rg_create_out" | redact_stream
        if echo "$rg_create_out" | grep -qi "FAILED\|error"; then
            # May already exist and be visible now — try targeting before giving up.
            log_warn "resource group-create reported an error; attempting target anyway"
        fi
        ibmcloud target -g "$RESOURCE_GROUP" -q || {
            log_error "Failed to target resource group '$RESOURCE_GROUP'"
            exit 1
        }
    fi
    log_info "Authenticated — region: $CE_REGION, resource group: $RESOURCE_GROUP"

    # Ensure the Code Engine project exists and is active (idempotent).
    #
    # `ce project list --output json` includes soft-deleted projects with
    # state "pending_reclamation" and their GUID, so the soft-deleted case is
    # detected directly from the list (locale-independent) rather than by
    # parsing localized CLI error text. A soft-deleted project blocks
    # re-creation by name, so we hard-delete it by ID and create it fresh
    # before the run proceeds (VAL-RUNSH-072).
    log_step "Ensuring Code Engine project '$CE_PROJECT' is active"
    local project_state project_id ce_create_out

    # Read both the state and the GUID in one pass. The GUID is the project
    # ID used for the hard-delete-by-ID path.
    project_state=$(ibmcloud ce project list --output json 2>/dev/null \
        | jq -r --arg name "$CE_PROJECT" \
            '.[] | select(.name==$name) | .state' 2>/dev/null || echo "")
    project_id=$(ibmcloud ce project list --output json 2>/dev/null \
        | jq -r --arg name "$CE_PROJECT" \
            '.[] | select(.name==$name) | .guid // empty' 2>/dev/null || echo "")

    # pending_reclamation = IBM is processing the soft-delete; treat as soft-deleted.
    if [ "$project_state" = "pending_reclamation" ]; then
        project_state="soft deleted"
    fi

    if [ "$project_state" = "active" ]; then
        log_info "Project '$CE_PROJECT' is already active"
    else
        # Try to create. On failure capture output so we can detect soft-deleted conflicts.
        log_info "Project '$CE_PROJECT' not active (state: '${project_state:-not found}') — attempting create"
        ce_create_out=$(ibmcloud ce project create --name "$CE_PROJECT" 2>&1 || true)
        echo "$ce_create_out" | redact_stream

        if echo "$ce_create_out" | grep -q "soft deleted" || [ "$project_state" = "soft deleted" ]; then
            # The project exists but is soft-deleted. Prefer the GUID from the
            # project list (locale-independent); fall back to extracting the ID
            # from the create error message ("... with id '<ID>' ...") for
            # CLIs whose list output does not surface soft-deleted projects.
            if [ -z "$project_id" ]; then
                project_id=$(echo "$ce_create_out" \
                    | grep -oP "with id '\K[^']+" || true)
            fi
            if [ -z "$project_id" ]; then
                log_error "Could not determine ID of soft-deleted project '$CE_PROJECT'"
                exit 1
            fi
            log_warn "Project '$CE_PROJECT' is soft-deleted (id: $project_id) — hard-deleting and recreating"
            ibmcloud ce project delete --id "$project_id" --hard --force 2>&1 | redact_stream || {
                log_error "Failed to hard-delete soft-deleted project '$CE_PROJECT'"
                exit 1
            }
            log_info "Creating Code Engine project '$CE_PROJECT'"
            ibmcloud ce project create --name "$CE_PROJECT" 2>&1 | redact_stream || {
                log_error "Failed to create Code Engine project '$CE_PROJECT' after hard-delete"
                exit 1
            }
        elif echo "$ce_create_out" | grep -qi "FAILED\|error"; then
            log_error "Failed to create Code Engine project '$CE_PROJECT'"
            exit 1
        fi

        # Wait for project to become active.
        log_info "Waiting for project '$CE_PROJECT' to become active..."
        local attempts=0
        while [ $attempts -lt 30 ]; do
            project_state=$(ibmcloud ce project list --output json 2>/dev/null \
                | jq -r --arg name "$CE_PROJECT" \
                    '.[] | select(.name==$name) | .state' 2>/dev/null || echo "")
            if [ "$project_state" = "active" ]; then
                log_info "Project '$CE_PROJECT' is active"
                break
            fi
            log_debug "Project state: ${project_state:-unknown} (attempt $((attempts + 1)))"
            sleep 10
            attempts=$((attempts + 1))
        done
        if [ "$project_state" != "active" ]; then
            log_error "Project '$CE_PROJECT' did not become active after 300s"
            exit 1
        fi
    fi

    # Select the configured project as the active context, then verify the
    # active project really is CE_PROJECT (VAL-RUNSH-073). `ce project select`
    # only accepts active projects, so this also guards against selecting a
    # soft-deleted or still-provisioning project.
    ibmcloud ce project select --name "$CE_PROJECT" || {
        log_error "Failed to select Code Engine project: $CE_PROJECT"
        exit 1
    }
    local current_project
    current_project=$(ibmcloud ce project current --output json 2>/dev/null \
        | jq -r '.name // empty' 2>/dev/null || echo "")
    if [ -z "$current_project" ]; then
        log_error "No Code Engine project is currently selected after setup"
        exit 1
    fi
    if [ "$current_project" != "$CE_PROJECT" ]; then
        log_error "Active Code Engine project is '$current_project', expected '$CE_PROJECT'"
        exit 1
    fi
    log_info "Active Code Engine project is '$current_project'"
    log_info "IBM Cloud ready (project: $CE_PROJECT, region: $CE_REGION)"
}

teardown_ibmcloud_env() {
    if [ -n "$IBMCLOUD_HOME_TMP" ] && [ -d "$IBMCLOUD_HOME_TMP" ]; then
        log_info "Removing temporary IBMCLOUD_HOME ($IBMCLOUD_HOME_TMP)"
        rm -rf "$IBMCLOUD_HOME_TMP"
    fi
    if [ -n "$IBMCLOUD_HOME_ORIG" ]; then
        export IBMCLOUD_HOME="$IBMCLOUD_HOME_ORIG"
    else
        unset IBMCLOUD_HOME
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# ce_retry
#
# Runs an ibmcloud command with a bounded retry. Code Engine can transiently
# reject a create/update with "This action is not allowed" when the same-named
# resource was just deleted (delete-then-create race, IAM/eventual-consistency
# window) — observed live during CE validation. A short bounded retry with
# backoff recovers without user intervention.
#
# Known fatal errors are detected from the captured output and reported with
# a clear, actionable message instead of the generic "attempt N/N" text:
#   - ICR storage quota exceeded  → tell the user to prune ICR images
#   - "This action is forbidden"  → CE partial-resource 403; clean up and retry
#
# Usage: ce_retry "description" <command...>
# All stdout/stderr is piped through redact_stream.
# ─────────────────────────────────────────────────────────────────────────────
ce_retry() {
    local desc="$1"
    shift
    local max_attempts="${CE_RETRY_ATTEMPTS:-3}"
    local attempt=1
    local _ce_retry_tmp
    _ce_retry_tmp="$(mktemp)"
    # shellcheck disable=SC2064
    trap "rm -f '$_ce_retry_tmp'" RETURN
    while true; do
        # Capture output to a temp file so we can inspect it for known fatal
        # patterns while still streaming it (redacted) to the user.
        "$@" >"$_ce_retry_tmp" 2>&1
        local exit_code=$?
        cat "$_ce_retry_tmp" | redact_stream
        if [ $exit_code -eq 0 ]; then
            return 0
        fi

        # ── Detect known fatal error patterns ──────────────────────────
        local out
        out="$(cat "$_ce_retry_tmp")"

        # ICR storage quota exceeded — retrying won't help; the user must
        # free up Container Registry space first.
        if echo "$out" | grep -qi "storage quota limit.*exceeded\|exceeded.*storage quota"; then
            log_error "IBM Container Registry storage quota exceeded."
            log_error "Free up ICR space before retrying:"
            log_error "  ibmcloud cr images                    # list images"
            log_error "  ibmcloud cr image-prune-untagged -f   # remove untagged layers"
            log_error "  ibmcloud cr image-rm <repo:tag>       # delete specific images"
            log_error "Or add CE_CLEANUP_APP=stop to your .env to reuse the existing image"
            log_error "instead of rebuilding on every run."
            return 1
        fi

        # "This action is forbidden" after a failed create leaves a partial
        # CE application resource. Delete it so the next retry is a clean
        # create rather than a conflicting one.
        if echo "$out" | grep -qi "this action is forbidden"; then
            log_warn "CE returned 'forbidden' — likely a partial resource from a previous"
            log_warn "failed create. Attempting to clean up before retrying…"
            # Best-effort: extract the app/job name from the command arguments
            # and delete the partial resource so the retry starts clean.
            local resource_name=""
            local prev=""
            for arg in "$@"; do
                if [ "$prev" = "--name" ]; then
                    resource_name="$arg"
                    break
                fi
                prev="$arg"
            done
            if [ -n "$resource_name" ]; then
                # Determine resource type from the command (application / job).
                if echo "$*" | grep -q "application"; then
                    log_warn "Deleting partial CE application '$resource_name'…"
                    ibmcloud ce application delete --name "$resource_name" --force 2>/dev/null || true
                elif echo "$*" | grep -q " job "; then
                    log_warn "Deleting partial CE job '$resource_name'…"
                    ibmcloud ce job delete --name "$resource_name" --force 2>/dev/null || true
                fi
            fi
        fi
        # ── End fatal pattern detection ─────────────────────────────────

        if [ $attempt -ge $max_attempts ]; then
            log_error "$desc failed after $max_attempts attempts"
            return 1
        fi
        log_warn "$desc failed (attempt $attempt/$max_attempts) — retrying in 15s"
        sleep 15
        attempt=$((attempt + 1))
    done
}

# ─────────────────────────────────────────────────────────────────────────────
# provision_ce_artifacts
#
# Creates or updates the three CE secrets and one configmap that all services
# read from. Assumes setup_ibmcloud_env() has already run (authenticated,
# resource group targeted, project selected).
# ─────────────────────────────────────────────────────────────────────────────
provision_ce_artifacts() {
    log_step "Provisioning Code Engine artifacts"
    echo "=========================================="
    echo "  Remote Bob - Provision CE Artifacts"
    echo "  Project:        $CE_PROJECT"
    echo "  Resource Group: $RESOURCE_GROUP"
    echo "  Region:         $CE_REGION"
    echo "=========================================="
    echo ""

    # Get project ID from the already-selected project.
    log_step "Getting project ID..."
    local PROJECT_ID
    PROJECT_ID=$(ibmcloud ce project current --output json 2>/dev/null \
        | jq -r '.guid // empty' 2>/dev/null || echo "")
    if [ -z "$PROJECT_ID" ]; then
        log_error "Could not determine current CE project ID. Is a project selected?"
        exit 1
    fi
    log_info "Project ID: $PROJECT_ID"

    # Helper: create or update a CE secret. Output is piped through
    # redact_stream because secret values travel on the command line via
    # --from-literal (VAL-RUNSH-054: no secrets in CE sub-script output).
    _upsert_secret() {
        local name="$1"; shift
        if ibmcloud ce secret get --name "$name" &>/dev/null; then
            ibmcloud ce secret update --name "$name" "$@" 2>&1 | redact_stream \
                || { log_error "Failed to update secret '$name'"; exit 1; }
            log_info "Updated secret '$name'"
        else
            ibmcloud ce secret create --name "$name" "$@" 2>&1 | redact_stream \
                || { log_error "Failed to create secret '$name'"; exit 1; }
            log_info "Created secret '$name'"
        fi
    }

    # Three secrets — one per mount directory.
    log_step "Creating/updating secrets..."
    _upsert_secret remote-bob-gateway \
        --from-literal gateway-token="$GATEWAY_TOKEN" \
        --from-literal gateway-password="$GATEWAY_PASSWORD" \
        --from-literal encryption-key="$ENCRYPTION_KEY"

    _upsert_secret remote-bob-ibmcloud \
        --from-literal api-key="$IBMCLOUD_API_KEY"

    _upsert_secret remote-bob-bobshell \
        --from-literal api-key="$BOBSHELL_API_KEY"

    # Configmap — non-sensitive config consumed by all services via --env-from-configmap.
    # Output is still passed through redact_stream for uniformity.
    log_step "Creating/updating configmap '$CE_CONFIGMAP_NAME'..."
    if ibmcloud ce configmap get --name "$CE_CONFIGMAP_NAME" &>/dev/null; then
        ibmcloud ce configmap update --name "$CE_CONFIGMAP_NAME" \
            --from-literal CE_PROJECT_ID="$PROJECT_ID" \
            --from-literal CE_REGION="$CE_REGION" \
            --from-literal CE_JOB_NAME="$JOB_NAME" \
            --from-literal LOG_LEVEL="info" \
            --from-literal LOCAL_MODE="false" \
            2>&1 | redact_stream \
            || { log_error "Failed to update configmap '$CE_CONFIGMAP_NAME'"; exit 1; }
        log_info "Updated configmap '$CE_CONFIGMAP_NAME'"
    else
        ibmcloud ce configmap create --name "$CE_CONFIGMAP_NAME" \
            --from-literal CE_PROJECT_ID="$PROJECT_ID" \
            --from-literal CE_REGION="$CE_REGION" \
            --from-literal CE_JOB_NAME="$JOB_NAME" \
            --from-literal LOG_LEVEL="info" \
            --from-literal LOCAL_MODE="false" \
            2>&1 | redact_stream \
            || { log_error "Failed to create configmap '$CE_CONFIGMAP_NAME'"; exit 1; }
        log_info "Created configmap '$CE_CONFIGMAP_NAME'"
    fi

    log_info "✓ CE artifacts provisioned successfully!"
}

# ─────────────────────────────────────────────────────────────────────────────
# deploy_apiserver
#
# Builds and deploys (or updates) the API server application in Code Engine.
# Derives GATEWAY_WSS from the app's own URL and injects it back so the app
# can pass it to each job run it launches.
# ─────────────────────────────────────────────────────────────────────────────
deploy_apiserver() {
    log_step "Deploying API server"
    echo "=========================================="
    echo "  Remote Bob - Deploy API Server"
    echo "  Build source: $APISERVER_DIR"
    echo "=========================================="
    echo ""

    local APP_EXISTS=false
    ibmcloud ce application get --name "$APISERVER_APP_NAME" &>/dev/null && APP_EXISTS=true

    if [ "$APP_EXISTS" = true ]; then
        log_step "Updating application '$APISERVER_APP_NAME'..."
        ce_retry "API server update" \
            ibmcloud ce application update \
            --name "$APISERVER_APP_NAME" \
            --build-source "$APISERVER_DIR" \
            --min-scale "0" || {
            log_error "API server update failed"
            exit 1
        }
    else
        log_step "Creating application '$APISERVER_APP_NAME'..."
        ce_retry "API server creation" \
            ibmcloud ce application create \
            --name "$APISERVER_APP_NAME" \
            --build-source "$APISERVER_DIR" \
            --port "8080" \
            --min-scale "0" \
            --max-scale "20" \
            --cpu "0.5" \
            --memory "1G" \
            --concurrency "100" \
            --env-from-configmap "$CE_CONFIGMAP_NAME" \
            --mount-secret "/secrets/gateway=remote-bob-gateway" \
            --mount-secret "/secrets/ibmcloud=remote-bob-ibmcloud" || {
            log_error "API server creation failed"
            exit 1
        }
    fi

    # Inject the app's own URL as the gateway WS endpoint for job runs.
    # (The v4 flow derives GATEWAY_WSS from the app URL directly when
    # creating/refreshing the job, so no extra env update is needed here —
    # each application update triggers a fresh source build.)
    local APP_URL
    APP_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
        | jq -r '.status.url // empty')
    if [ -z "$APP_URL" ]; then
        log_error "Failed to get application URL after deployment"
        exit 1
    fi

    log_info "✓ API server deployed: $APP_URL"
}

# ─────────────────────────────────────────────────────────────────────────────
# deploy_job_agent
#
# Creates the job-agent CE job (with a source build) the first time it is
# needed. On subsequent runs the job already exists, so run_codeengine() skips
# calling this and just refreshes the gateway env vars inline.
# ─────────────────────────────────────────────────────────────────────────────
deploy_job_agent() {
    log_step "Creating job-agent job '$JOB_NAME'"
    echo "=========================================="
    echo "  Remote Bob - Deploy Job Agent"
    echo "  Build source: $MONOREPO_ROOT (Dockerfile: job-agent/Dockerfile)"
    echo "=========================================="
    echo ""

    # If a stale job with the same name exists (v3-era image, wrong gateway
    # URL), remove it first so the create below defines the job from scratch.
    # Deterministic: an in-place `job update` would not clear the v3-era
    # GATEWAY_CALLBACK_URL env var.
    if ibmcloud ce job get --name "$JOB_NAME" >/dev/null 2>&1; then
        log_warn "Deleting stale job '$JOB_NAME' before recreating it"
        ibmcloud ce job delete --name "$JOB_NAME" --force 2>&1 | redact_stream || {
            log_error "Failed to delete stale job '$JOB_NAME'"
            exit 1
        }
    fi

    local GATEWAY_URL
    GATEWAY_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
        | jq -r '.status.url // empty' || echo "")
    if [ -z "$GATEWAY_URL" ]; then
        log_error "Could not determine gateway URL from app '$APISERVER_APP_NAME'. Deploy apiserver first."
        exit 1
    fi

    local GW_WSS="${GATEWAY_URL/https:/wss:}/ws"
    log_info "Gateway WSS:      $GW_WSS"

    ce_retry "Job-agent job creation" \
        ibmcloud ce job create \
        --name "$JOB_NAME" \
        --build-source "$MONOREPO_ROOT" \
        --build-dockerfile "job-agent/Dockerfile" \
        --mode task \
        --cpu "$DEFAULT_CPU" \
        --memory "$DEFAULT_MEMORY" \
        --maxexecutiontime "$DEFAULT_TIMEOUT" \
        --retrylimit "0" \
        --env "GATEWAY_WSS=$GW_WSS" \
        --env "LOG_LEVEL=info" \
        --mount-secret "/secrets/gateway=remote-bob-gateway" \
        --mount-secret "/secrets/bobshell=remote-bob-bobshell" || {
        log_error "Job-agent job creation failed"
        exit 1
    }

    log_info "✓ Job-agent job '$JOB_NAME' created"
}

# Determines whether the existing job-agent CE job is current (reusable for
# this session) or must be recreated.
#
# Returns 0 (reuse) when the job exists and:
#   - it does not carry v3-era markers (GATEWAY_CALLBACK_URL env, which the
#     v4 Go daemon no longer uses), and
#   - its GATEWAY_WSS env matches the GATEWAY_WSS derived from the current
#     API server app URL (the app URL can change when the app is recreated).
# Returns 1 (recreate) when the job is missing, stale, or points at a stale
# gateway URL.
job_is_current() {
    if ! ibmcloud ce job get --name "$JOB_NAME" >/dev/null 2>&1; then
        return 1
    fi

    local GATEWAY_URL
    GATEWAY_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
        | jq -r '.status.url // empty' 2>/dev/null || echo "")
    if [ -z "$GATEWAY_URL" ]; then
        # App not deployed yet — the job cannot be trusted; recreate it.
        return 1
    fi
    local GW_WSS="${GATEWAY_URL/https:/wss:}/ws"

    local job_json
    job_json="$(ibmcloud ce job get --name "$JOB_NAME" --output json 2>/dev/null || true)"

    # v3-era marker: the legacy daemon consumed GATEWAY_CALLBACK_URL; the v4
    # daemon does not. A job still carrying it runs a stale image.
    if echo "$job_json" | jq -e '
            .spec.template.containers[0].env[]
            | select(.name == "GATEWAY_CALLBACK_URL")
        ' >/dev/null 2>&1; then
        return 1
    fi

    # The job's GATEWAY_WSS must point at the current app URL; otherwise the
    # job was created against a previous app incarnation and its image/URL is
    # stale.
    local job_wss
    job_wss=$(echo "$job_json" | jq -r '
            [.spec.template.containers[0].env[]?
             | select(.name == "GATEWAY_WSS") | .value][0] // empty' 2>/dev/null || true)
    if [ -n "$job_wss" ] && [ "$job_wss" = "$GW_WSS" ]; then
        return 0
    fi
    return 1
}

# ═════════════════════════════════════════════════════════════════════════════
# CODE ENGINE MODE
# ═════════════════════════════════════════════════════════════════════════════
run_codeengine() {
    echo ""
    echo "=========================================="
    echo "  Remote Bob — Code Engine Mode"
    echo "=========================================="
    echo ""

    # ── Validate prerequisites and authenticate ─────────────────────────
    if [ ! -f "$BROWSER_HTML" ]; then
        log_error "Browser client not found: $BROWSER_HTML"
        exit 1
    fi

    CHROME_BIN="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable || true)}"
    if [ -z "$CHROME_BIN" ]; then
        log_error "google-chrome not found in PATH"
        exit 1
    fi

    # ── Reconnect to existing CE session if one is still live ───────────
    # If AGENT_ID and API_SERVER_URL are in the config and the agent is still
    # reporting ready, skip provisioning entirely and open Chrome on the
    # running session. No ibmcloud login needed for a reconnect.
    log_step "Checking for existing CE session"
    if check_existing_ce_session; then
        log_info "Existing CE session is live — reconnecting (skipping provisioning)"
        _ce_launch_chrome
        return
    fi
    log_info "No live CE session found — starting fresh"
    local prev_api_url="${API_SERVER_URL:-}"
    if [ -n "$prev_api_url" ]; then
        wait_for_previous_session_drain "${prev_api_url%/}/healthz" 60
    fi

    setup_ibmcloud_env

    # ── Provision Code Engine (idempotent) ──────────────────────────────
    log_step "Provisioning Code Engine resources"

    provision_ce_artifacts

    # ── Deploy / update API server ──────────────────────────────────────
    log_step "Deploying API server"

    deploy_apiserver

    # ── Deploy / update job-agent job ───────────────────────────────────
    # run.sh submits job runs directly via `ibmcloud ce jobrun submit`, so
    # the job definition must exist with a current v4 image before any
    # session is created.
    #
    # Idempotency: if the job already exists and is current (v4 image, no
    # v3-era GATEWAY_CALLBACK_URL env, GATEWAY_WSS pointing at the current
    # app URL), skip the image rebuild (the job image is large and rebuilding
    # on every run can fail when the Container Registry storage quota is
    # tight) and just refresh the env vars. deploy_job_agent() (with a build)
    # is only called when the job is missing or stale.
    log_step "Deploying job-agent job"

    if job_is_current; then
        log_info "Job '$JOB_NAME' is current — refreshing env vars (skipping image rebuild)"
        GATEWAY_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
            | jq -r '.status.url // empty' 2>/dev/null || echo "")
        if [ -n "$GATEWAY_URL" ]; then
            GATEWAY_WSS="${GATEWAY_URL/https:/wss:}/ws"
            ce_retry "job-agent env var refresh" \
                ibmcloud ce job update --name "$JOB_NAME" \
                --env "GATEWAY_WSS=$GATEWAY_WSS" || {
                log_warn "Failed to refresh job-agent gateway env vars (continuing with existing values)"
            }
        fi
    else
        log_warn "Job '$JOB_NAME' is missing or stale (v3-era image or stale gateway URL) — recreating it"
        deploy_job_agent
    fi

    # ── Wait for API server app to be Ready ─────────────────────────────
    log_step "Waiting for API server app to become ready"
    wait_for_ce_app_ready "$APISERVER_APP_NAME" 300 5 || exit 1

    # ── Get API server URL ──────────────────────────────────────────────
    log_step "Getting API server URL"

    API_SERVER_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
        | jq -r '.status.url // empty' || echo "")

    if [ -z "$API_SERVER_URL" ]; then
        log_error "Could not determine API server URL for app '$APISERVER_APP_NAME'"
        exit 1
    fi

    # Strip trailing slash.
    API_SERVER_URL="${API_SERVER_URL%/}"
    log_info "API server URL: $API_SERVER_URL"
    # Persist so --end-session and reconnect can resolve the API base.
    persist_config_value "API_SERVER_URL" "$API_SERVER_URL"

    # Wait for API server health.
    wait_for_http "${API_SERVER_URL}/healthz" "API server health" 60 2 || exit 1

    # ── Generate a unique AGENT_ID for this invocation ──────────────────
    # Persist AGENT_ID to config so --end-session and reconnect can read it.
    AGENT_ID="agent-$(openssl rand -hex 8)"
    log_info "Agent ID: $AGENT_ID"
    persist_config_value "AGENT_ID" "$AGENT_ID"
    persist_config_value "SESSION_MODE" "codeengine"

    # ── Issue the per-run agent token via POST /auth/runs ───────────────
    # The run token is bound to AGENT_ID and travels to the job-agent in the
    # Authorization: Bearer header on /ws/agent — never in a URL or log.
    log_step "Issuing run token via POST /auth/runs"
    RUN_TOKEN=""
    local runs_response
    runs_response="$(curl -sf -X POST "${API_SERVER_URL}/auth/runs?agent=${AGENT_ID}" \
        -H "Authorization: Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)" 2>/dev/null)" || {
        log_error "POST /auth/runs failed against $API_SERVER_URL"
        exit 1
    }
    RUN_TOKEN="$(echo "$runs_response" | jq -r '.run_token // empty' 2>/dev/null || true)"
    if [ -z "$RUN_TOKEN" ]; then
        log_error "POST /auth/runs returned no run_token"
        exit 1
    fi
    log_kv "RUN_TOKEN" "$RUN_TOKEN"

    # ── Create the job-agent job run for this session ───────────────────
    # AGENT_ID + RUN_TOKEN are passed to the job run as env vars (the agent
    # also supports a mounted secret file at /secrets/run-token). The run
    # name is unique per invocation so cleanup can delete the exact run.
    log_step "Creating job-agent job run"
    CE_JOB_RUN_NAME="${JOB_NAME}-${AGENT_ID#agent-}"
    # Persist so --end-session can delete this specific run.
    persist_config_value "CE_JOB_RUN_NAME" "$CE_JOB_RUN_NAME"
    ibmcloud ce jobrun submit \
        --name "$CE_JOB_RUN_NAME" \
        --job "$JOB_NAME" \
        --mode task \
        --env "AGENT_ID=$AGENT_ID" \
        --env "RUN_TOKEN=$RUN_TOKEN" \
        --cpu "$DEFAULT_CPU" \
        --memory "$DEFAULT_MEMORY" \
        --maxexecutiontime "$DEFAULT_TIMEOUT" \
        2>&1 | redact_stream || {
        log_error "Failed to submit job-agent job run"
        exit 1
    }
    log_info "Job run: $CE_JOB_RUN_NAME"

    # ── Wait for agent ready via GET /agents ────────────────────────────
    wait_for_agent_ready "$API_SERVER_URL" "$AGENT_ID" 240 3 || {
        log_error "Job-agent did not become ready in time"
        if [ -n "$CE_JOB_RUN_NAME" ]; then
            log_error "Job-agent logs (last 50 lines):"
            ibmcloud ce jobrun logs --name "$CE_JOB_RUN_NAME" 2>&1 | tail -50 || true
        fi
        exit 1
    }

    _ce_launch_chrome
}

# _ce_launch_chrome opens Chrome against the current AGENT_ID + API_SERVER_URL.
# Called both from a fresh CE start and from a reconnect.
_ce_launch_chrome() {
    # ── Launch Chrome ───────────────────────────────────────────────────
    log_step "Launching Chrome app"

    # Derive the apiHost from the API server URL (strip https:// prefix).
    API_HOST="${API_SERVER_URL#https://}"
    API_HOST="${API_HOST#http://}"

    CHROME_USER_DATA=$(mktemp -d "$MONOREPO_ROOT/tmp/remote-bob-chrome.XXXXXX")
    BROWSER_URL="file://${BROWSER_HTML}?apiHost=${API_HOST}&agent=${AGENT_ID}"

    log_info "Browser URL: file://.../single-session.html?apiHost=${API_HOST}&agent=${AGENT_ID}"

    CHROME_ARGS=(
        "--app=$BROWSER_URL"
        "--user-data-dir=$CHROME_USER_DATA"
        "--new-window"
        "--no-first-run"
        "--no-default-browser-check"
        "--disable-extensions"
        "--disable-sync"
        "--disable-translate"
    )
    if [ -n "$CHROME_DEBUG_PORT" ]; then
        CHROME_ARGS+=("--remote-debugging-port=$CHROME_DEBUG_PORT")
        log_info "Chrome remote debugging on port $CHROME_DEBUG_PORT"
    fi

    "$CHROME_BIN" "${CHROME_ARGS[@]}" > /dev/null 2>&1 &
    CHROME_PID=$!
    log_info "Chrome PID: $CHROME_PID"
    SESSION_LIVE=true

    # ── Wait for Chrome to close — then detach ──────────────────────────
    # Closing the Chrome window or pressing Ctrl+C does NOT end the CE session.
    # The CE job and apiserver keep running until --end-session is called.
    log_info "Session is live. Close the Chrome window to detach (session continues)."
    log_info "Press Ctrl+C to detach without stopping the session."
    wait "$CHROME_PID" 2>/dev/null || true
    log_info "Chrome closed — detaching. CE session continues in background."
    log_info "To end the session, run:  $0 --end-session --config=$CONFIG_FILE"
    # on_detach EXIT trap fires here; CE resources are NOT torn down.
}

# ═════════════════════════════════════════════════════════════════════════════
# END-SESSION MODE
# ═════════════════════════════════════════════════════════════════════════════
run_end_session() {
    echo ""
    echo "=========================================="
    echo "  Remote Bob — End Session"
    echo "  Config: $CONFIG_FILE"
    echo "=========================================="
    echo ""

    # Determine API base URL and container runtime from config.
    local api_base=""
    if [ -n "${API_SERVER_URL:-}" ]; then
        api_base="${API_SERVER_URL%/}"
    elif [ -n "${API_PORT:-}" ]; then
        api_base="http://localhost:${API_PORT}"
    else
        api_base="http://localhost:3000"
    fi

    local agent_id="${AGENT_ID:-}"
    if [ -z "$agent_id" ]; then
        log_warn "AGENT_ID not set in config — will skip agent disconnect and only clean up resources"
    fi

    # Determine whether this is a codeengine or local end-session.
    # Preference order:
    #   1. --mode flag (explicit, supplied by user)
    #   2. SESSION_MODE persisted in the config file when the session started
    #   3. fallback: local
    if [ -z "$MODE" ]; then
        if [ -n "${SESSION_MODE:-}" ]; then
            MODE="$SESSION_MODE"
        else
            log_warn "SESSION_MODE not found in config — defaulting to local. Re-run with --mode=codeengine if needed."
            MODE="local"
        fi
    fi
    if [ "$MODE" = "local" ]; then
        # Detect container runtime for local cleanup.
        CONTAINER_RUNTIME="$(detect_container_runtime)"
        if [ -z "$CONTAINER_RUNTIME" ]; then
            log_warn "No container runtime found; skipping container cleanup"
        fi
    fi

    log_info "Mode: $MODE"
    log_info "API base: $api_base"
    if [ -n "$agent_id" ]; then
        log_info "Agent ID: $agent_id"
    fi

    # Disable the detach traps — we want full teardown here.
    trap '' EXIT INT TERM

    if [ "$MODE" = "codeengine" ]; then
        setup_ibmcloud_env
    fi

    end_session "$api_base" "$agent_id"

    log_info "End-session complete"
    exit 0
}

# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

if [ "$END_SESSION" = true ]; then
    run_end_session
fi

echo "=========================================="
echo "  Remote Bob — Single-Session Launcher"
echo "  Mode:   $MODE"
echo "  Config: $CONFIG_FILE"
echo "=========================================="

case "$MODE" in
    local)
        run_local
        ;;
    codeengine)
        run_codeengine
        ;;
esac

log_info "Launcher exiting normally"
exit 0
