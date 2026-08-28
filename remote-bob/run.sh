#!/bin/bash
# Remote Bob — Code Engine Launcher Script
# =============================================================================
# Single-session, no-persistence remote terminal launcher for IBM Code Engine.
#
# Usage:
#   cp .env.template .env   # once — fill in BOBSHELL_API_KEY + GATEWAY_PASSWORD
#   ./run.sh --config=.env
#   ./run.sh --end-session --config=.env
#   ./run.sh --help
#
# Flow (fresh start):
#   Authenticate to IBM Cloud → provision CE secrets + configmap (idempotent)
#   → deploy/update apiserver app → ensure job-agent job (rebuild only when
#   stale) → POST /auth/runs → AGENT_ID + RUN_TOKEN → submit job run →
#   wait GET /agents ready → open Chrome at deployed app → detach.
#
# Reconnect flow:
#   AGENT_ID and API_SERVER_URL in .env, apiserver reachable, agent status
#   "ready" → open Chrome on running session, skip provisioning entirely.
#
# End-session:
#   --end-session  Calls DELETE /agents/{id}, deletes the job run, and
#                  deletes (or scales to zero) the apiserver app.
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
    GATEWAY_TOKEN ENCRYPTION_KEY
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
# output. Uses awk for literal (non-glob, non-regex) string replacement so
# secret values containing +, *, ?, [, /, = etc. are safe.
redact_stream() {
    local awk_script='{ line = $0 }'
    for sk in "${SECRET_KEYS[@]}"; do
        local val="${!sk:-}"
        if [ -n "$val" ]; then
            local masked
            masked="$(mask_secret "$val")"
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
Remote Bob — Code Engine Session Launcher

Usage:
  cp .env.template .env     # one-time setup — fill in BOBSHELL_API_KEY and GATEWAY_PASSWORD
  $0 --config=CONFIG_FILE
  $0 --end-session --config=CONFIG_FILE
  $0 --help

Options:
  --config=FILE      Required. Path to .env config file (use .env.template as starting point).
  --end-session      Terminate the running session instead of starting one.
  --help             Show this help and exit.

Config file (.env) — required keys:
  BOBSHELL_API_KEY     Bob Shell API key (from https://bob.ibm.com)
  GATEWAY_PASSWORD     Gateway basic-auth password
  IBMCLOUD_API_KEY     IBM Cloud API key

Config file — optional keys (generated if missing):
  GATEWAY_TOKEN        Gateway auth token (hex, 32 chars)
  ENCRYPTION_KEY       AES-256 key (base64, 44 chars)

Code Engine settings (with defaults):
  CE_REGION            Code Engine region (default: us-east)
  CE_PROJECT           Code Engine project name
  RESOURCE_GROUP       IBM Cloud resource group
  DEFAULT_CPU          Job-agent run CPU (default: 1)
  DEFAULT_MEMORY       Job-agent run memory (default: 2G)
  DEFAULT_TIMEOUT      Job-agent run max execution seconds (default: 86400)
  CE_CLEANUP_APP       delete (default) or stop the apiserver app on end-session
  CHROME_DEBUG_PORT    Optional Chrome remote-debugging port

Session state (.env — written by run.sh, do not edit manually):
  AGENT_ID, API_SERVER_URL, CE_JOB_RUN_NAME, SESSION_MODE

Reconnect behaviour:
  If AGENT_ID and API_SERVER_URL are in .env and the agent is still "ready",
  the script skips provisioning and opens Chrome on the running session.
  To force a fresh session, run --end-session first.

Env var precedence: shell environment > .env config file.
EOF
}

# ── Parse arguments ─────────────────────────────────────────────────────────
CONFIG_FILE=""
END_SESSION=false

while [ $# -gt 0 ]; do
    case "$1" in
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
# precedence over the same key in the config file.
set -a
while IFS= read -r line; do
    case "$line" in
        ""|\#*) continue ;;
    esac
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

if [ "$END_SESSION" = false ]; then
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
CE_REGION="${CE_REGION:-us-east}"
CE_PROJECT="${CE_PROJECT:-remote-bob-fleet-sandbox--ce-project}"
RESOURCE_GROUP="${RESOURCE_GROUP:-remote-bob-fleet-sandbox--rg}"
JOB_NAME="${JOB_NAME:-remote-bob-job-agent}"
APISERVER_APP_NAME="${APISERVER_APP_NAME:-remote-bob-apiserver}"
CE_CONFIGMAP_NAME="${CE_CONFIGMAP_NAME:-remote-bob-config}"
DEFAULT_CPU="${DEFAULT_CPU:-1}"
DEFAULT_MEMORY="${DEFAULT_MEMORY:-2G}"
DEFAULT_TIMEOUT="${DEFAULT_TIMEOUT:-86400}"
# CE enforces a hard ceiling of 86400s (24h) on maxexecutiontime.
if [ "$DEFAULT_TIMEOUT" -gt 86400 ] 2>/dev/null; then
    DEFAULT_TIMEOUT=86400
fi
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

    echo "${key}=${new_val}" >> "$CONFIG_FILE"
    log_info "Generated and persisted $key"
    log_kv "$key" "$new_val"
    CREDENTIALS_GENERATED=true
}

log_step "Checking credentials"
generate_and_persist "GATEWAY_TOKEN" 'openssl rand -hex 16'
generate_and_persist "ENCRYPTION_KEY" 'openssl rand -base64 32'

if [ "$CREDENTIALS_GENERATED" = true ]; then
    log_info "Credentials written to $CONFIG_FILE"
fi

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

# ── Cleanup state ───────────────────────────────────────────────────────────
CHROME_PID=""
CHROME_USER_DATA=""
CE_JOB_RUN_NAME=""
CLEANUP_DONE=false
SESSION_LIVE=false

# ── Cleanup helpers ──────────────────────────────────────────────────────────
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

end_session() {
    local api_base="$1"
    local agent_id="${2:-${AGENT_ID:-}}"

    echo ""
    log_step "Ending session"

    if [ -n "$agent_id" ] && [ -n "$api_base" ] && [ -n "${GATEWAY_PASSWORD:-}" ]; then
        log_info "Disconnecting agent $agent_id via DELETE /agents/$agent_id ..."
        curl -sf -X DELETE "${api_base}/agents/${agent_id}" \
            -H "Authorization: Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)" \
            2>/dev/null || true
    fi

    cleanup_chrome
    cleanup_codeengine

    log_info "Session ended"
}

# on_detach: Chrome closed or Ctrl+C.
# If SESSION_LIVE=true → detach (CE resources keep running).
# If SESSION_LIVE=false → error before Chrome launched; tear down partially-started resources.
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
        cleanup_codeengine
    fi
}

trap on_detach EXIT
on_signal() {
    on_detach
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

# ── Helper: wait for agent readiness via GET /agents ────────────────────────
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

# ── Reconnect check ──────────────────────────────────────────────────────────
# Returns 0 when a previous CE session is still live (AGENT_ID + API_SERVER_URL
# set, apiserver reachable, agent "ready"), so the script can skip provisioning.
check_existing_ce_session() {
    local agent_id="${AGENT_ID:-}"
    local api_url="${API_SERVER_URL:-}"

    if [ -z "$agent_id" ] || [ -z "$api_url" ]; then
        return 1
    fi

    api_url="${api_url%/}"

    if ! curl -sf -o /dev/null "${api_url}/healthz" 2>/dev/null; then
        log_info "Previous CE apiserver at $api_url not reachable — starting fresh"
        return 1
    fi

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

# Waits for a previous apiserver to stop responding before starting fresh.
wait_for_previous_session_drain() {
    local health_url="$1"
    local timeout="${2:-60}"
    local elapsed=0

    if ! curl -sf -o /dev/null "$health_url" 2>/dev/null; then
        return 0
    fi

    log_info "Previous apiserver is still up — waiting for it to drain (max ${timeout}s)…"
    while [ "$elapsed" -lt "$timeout" ]; do
        sleep 2
        elapsed=$((elapsed + 2))
        if ! curl -sf -o /dev/null "$health_url" 2>/dev/null; then
            log_info "Previous apiserver has stopped (after ${elapsed}s)"
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

# ─────────────────────────────────────────────────────────────────────────────
# IBM Cloud environment helpers
# ─────────────────────────────────────────────────────────────────────────────
IBMCLOUD_HOME_ORIG="${IBMCLOUD_HOME:-}"
IBMCLOUD_HOME_TMP=""

setup_ibmcloud_env() {
    if ! command -v ibmcloud &>/dev/null; then
        log_error "ibmcloud CLI not found. Install from: https://cloud.ibm.com/docs/cli"
        exit 1
    fi
    if ! command -v jq &>/dev/null; then
        log_error "jq is required"
        exit 1
    fi

    IBMCLOUD_HOME_TMP="$SCRIPT_DIR/.ibmcloud-$$"
    mkdir -p "$IBMCLOUD_HOME_TMP"
    export IBMCLOUD_HOME="$IBMCLOUD_HOME_TMP"
    log_info "IBMCLOUD_HOME set to $IBMCLOUD_HOME_TMP"

    log_step "Updating ibmcloud plugins"
    ibmcloud plugin update --all -f 2>&1 | redact_stream || {
        log_warn "ibmcloud plugin update failed (continuing)"
    }

    if ! ibmcloud plugin list --output json 2>/dev/null \
            | jq -e '.[] | select(.Name=="code-engine")' >/dev/null 2>&1; then
        log_step "Installing ibmcloud code-engine plugin"
        ibmcloud plugin install -f code-engine 2>&1 | redact_stream || {
            log_error "Failed to install code-engine plugin"
            exit 1
        }
    fi

    log_step "Authenticating to IBM Cloud (region: $CE_REGION, resource group: $RESOURCE_GROUP)"
    if ! ibmcloud login --apikey "$IBMCLOUD_API_KEY" -r "$CE_REGION" -g "$RESOURCE_GROUP" -q 2>&1 | redact_stream; then
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
            log_warn "resource group-create reported an error; attempting target anyway"
        fi
        ibmcloud target -g "$RESOURCE_GROUP" -q || {
            log_error "Failed to target resource group '$RESOURCE_GROUP'"
            exit 1
        }
    fi
    log_info "Authenticated — region: $CE_REGION, resource group: $RESOURCE_GROUP"

    log_step "Ensuring Code Engine project '$CE_PROJECT' is active"
    local project_state project_id ce_create_out

    project_state=$(ibmcloud ce project list --output json 2>/dev/null \
        | jq -r --arg name "$CE_PROJECT" \
            '.[] | select(.name==$name) | .state' 2>/dev/null || echo "")
    project_id=$(ibmcloud ce project list --output json 2>/dev/null \
        | jq -r --arg name "$CE_PROJECT" \
            '.[] | select(.name==$name) | .guid // empty' 2>/dev/null || echo "")

    if [ "$project_state" = "pending_reclamation" ]; then
        project_state="soft deleted"
    fi

    if [ "$project_state" = "active" ]; then
        log_info "Project '$CE_PROJECT' is already active"
    else
        log_info "Project '$CE_PROJECT' not active (state: '${project_state:-not found}') — attempting create"
        ce_create_out=$(ibmcloud ce project create --name "$CE_PROJECT" 2>&1 || true)
        echo "$ce_create_out" | redact_stream

        if echo "$ce_create_out" | grep -q "soft deleted" || [ "$project_state" = "soft deleted" ]; then
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
# ce_retry — runs an ibmcloud command with bounded retry and known-fatal
# error detection (ICR quota, forbidden partial resource).
# Usage: ce_retry "description" <command...>
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
        "$@" >"$_ce_retry_tmp" 2>&1
        local exit_code=$?
        cat "$_ce_retry_tmp" | redact_stream
        if [ $exit_code -eq 0 ]; then
            return 0
        fi

        local out
        out="$(cat "$_ce_retry_tmp")"

        if echo "$out" | grep -qi "storage quota limit.*exceeded\|exceeded.*storage quota"; then
            log_error "IBM Container Registry storage quota exceeded."
            log_error "Free up ICR space before retrying:"
            log_error "  ibmcloud cr images                    # list images"
            log_error "  ibmcloud cr image-prune-untagged -f   # remove untagged layers"
            log_error "  ibmcloud cr image-rm <repo:tag>       # delete specific images"
            log_error "Or add CE_CLEANUP_APP=stop to your .env to reuse the existing image."
            return 1
        fi

        if echo "$out" | grep -qi "this action is forbidden"; then
            log_warn "CE returned 'forbidden' — likely a partial resource from a previous"
            log_warn "failed create. Attempting to clean up before retrying…"
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
                if echo "$*" | grep -q "application"; then
                    log_warn "Deleting partial CE application '$resource_name'…"
                    ibmcloud ce application delete --name "$resource_name" --force 2>/dev/null || true
                elif echo "$*" | grep -q " job "; then
                    log_warn "Deleting partial CE job '$resource_name'…"
                    ibmcloud ce job delete --name "$resource_name" --force 2>/dev/null || true
                fi
            fi
        fi

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
# provision_ce_artifacts — idempotent create/update of CE secrets and configmap.
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

    local PROJECT_ID
    PROJECT_ID=$(ibmcloud ce project current --output json 2>/dev/null \
        | jq -r '.guid // empty' 2>/dev/null || echo "")
    if [ -z "$PROJECT_ID" ]; then
        log_error "Could not determine current CE project ID. Is a project selected?"
        exit 1
    fi
    log_info "Project ID: $PROJECT_ID"

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

    log_step "Creating/updating secrets..."
    _upsert_secret remote-bob-gateway \
        --from-literal gateway-token="$GATEWAY_TOKEN" \
        --from-literal gateway-password="$GATEWAY_PASSWORD" \
        --from-literal encryption-key="$ENCRYPTION_KEY"

    _upsert_secret remote-bob-ibmcloud \
        --from-literal api-key="$IBMCLOUD_API_KEY"

    _upsert_secret remote-bob-bobshell \
        --from-literal api-key="$BOBSHELL_API_KEY"

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
# deploy_apiserver — creates or updates the apiserver CE application.
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
# deploy_job_agent — creates the job-agent CE job with a source build.
# Called only when the job is missing or stale.
# ─────────────────────────────────────────────────────────────────────────────
deploy_job_agent() {
    log_step "Creating job-agent job '$JOB_NAME'"
    echo "=========================================="
    echo "  Remote Bob - Deploy Job Agent"
    echo "  Build source: $MONOREPO_ROOT (Dockerfile: job-agent/Dockerfile)"
    echo "=========================================="
    echo ""

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
    log_info "Gateway WSS: $GW_WSS"

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

# Returns 0 when the existing job is current (v4 image, GATEWAY_WSS matches
# current app URL). Returns 1 when missing or stale.
job_is_current() {
    if ! ibmcloud ce job get --name "$JOB_NAME" >/dev/null 2>&1; then
        return 1
    fi

    local GATEWAY_URL
    GATEWAY_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
        | jq -r '.status.url // empty' 2>/dev/null || echo "")
    if [ -z "$GATEWAY_URL" ]; then
        return 1
    fi
    local GW_WSS="${GATEWAY_URL/https:/wss:}/ws"

    local job_json
    job_json="$(ibmcloud ce job get --name "$JOB_NAME" --output json 2>/dev/null || true)"

    # v3-era marker — job runs a stale image.
    if echo "$job_json" | jq -e '
            .spec.template.containers[0].env[]
            | select(.name == "GATEWAY_CALLBACK_URL")
        ' >/dev/null 2>&1; then
        return 1
    fi

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
# MAIN SESSION (Code Engine)
# ═════════════════════════════════════════════════════════════════════════════
run_codeengine() {
    echo ""
    echo "=========================================="
    echo "  Remote Bob — Code Engine"
    echo "  Config: $CONFIG_FILE"
    echo "=========================================="
    echo ""

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

    # ── Provision CE artifacts (idempotent) ─────────────────────────────
    provision_ce_artifacts

    # ── Deploy / update API server ───────────────────────────────────────
    deploy_apiserver

    # ── Deploy / update job-agent job ────────────────────────────────────
    log_step "Deploying job-agent job"

    if job_is_current; then
        log_info "Job '$JOB_NAME' is current — refreshing gateway env var"
        local GATEWAY_URL
        GATEWAY_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
            | jq -r '.status.url // empty' 2>/dev/null || echo "")
        if [ -n "$GATEWAY_URL" ]; then
            local GATEWAY_WSS="${GATEWAY_URL/https:/wss:}/ws"
            ce_retry "job-agent env var refresh" \
                ibmcloud ce job update --name "$JOB_NAME" \
                --env "GATEWAY_WSS=$GATEWAY_WSS" || {
                log_warn "Failed to refresh job-agent gateway env var (continuing with existing value)"
            }
        fi
    else
        log_warn "Job '$JOB_NAME' is missing or stale — recreating it"
        deploy_job_agent
    fi

    # ── Wait for API server app to be Ready ──────────────────────────────
    wait_for_ce_app_ready "$APISERVER_APP_NAME" 300 5 || exit 1

    # ── Get API server URL ───────────────────────────────────────────────
    API_SERVER_URL=$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json 2>/dev/null \
        | jq -r '.status.url // empty' || echo "")

    if [ -z "$API_SERVER_URL" ]; then
        log_error "Could not determine API server URL for app '$APISERVER_APP_NAME'"
        exit 1
    fi

    API_SERVER_URL="${API_SERVER_URL%/}"
    log_info "API server URL: $API_SERVER_URL"
    persist_config_value "API_SERVER_URL" "$API_SERVER_URL"

    wait_for_http "${API_SERVER_URL}/healthz" "API server health" 60 2 || exit 1

    # ── Generate a unique AGENT_ID ───────────────────────────────────────
    AGENT_ID="agent-$(openssl rand -hex 8)"
    log_info "Agent ID: $AGENT_ID"
    persist_config_value "AGENT_ID" "$AGENT_ID"
    persist_config_value "SESSION_MODE" "codeengine"

    # ── Issue the per-run agent token via POST /auth/runs ────────────────
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

    # ── Submit the job-agent job run ─────────────────────────────────────
    log_step "Creating job-agent job run"
    CE_JOB_RUN_NAME="${JOB_NAME}-${AGENT_ID#agent-}"
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

    # ── Wait for agent ready ─────────────────────────────────────────────
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

# Launches Chrome against the current AGENT_ID + API_SERVER_URL.
_ce_launch_chrome() {
    log_step "Launching Chrome app"

    local API_HOST="${API_SERVER_URL#https://}"
    API_HOST="${API_HOST#http://}"

    CHROME_USER_DATA=$(mktemp -d "$MONOREPO_ROOT/tmp/remote-bob-chrome.XXXXXX")
    local BROWSER_URL="file://${BROWSER_HTML}?apiHost=${API_HOST}&agent=${AGENT_ID}"

    log_info "Browser URL: file://.../single-session.html?apiHost=${API_HOST}&agent=${AGENT_ID}"

    local CHROME_ARGS=(
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

    log_info "Session is live. Close the Chrome window to detach (session continues)."
    log_info "Press Ctrl+C to detach without stopping the session."
    wait "$CHROME_PID" 2>/dev/null || true
    log_info "Chrome closed — detaching. CE session continues in background."
    log_info "To end the session, run:  $0 --end-session --config=$CONFIG_FILE"
}

# ═════════════════════════════════════════════════════════════════════════════
# END-SESSION
# ═════════════════════════════════════════════════════════════════════════════
run_end_session() {
    echo ""
    echo "=========================================="
    echo "  Remote Bob — End Session"
    echo "  Config: $CONFIG_FILE"
    echo "=========================================="
    echo ""

    local api_base=""
    if [ -n "${API_SERVER_URL:-}" ]; then
        api_base="${API_SERVER_URL%/}"
    else
        log_warn "API_SERVER_URL not set in config — will skip agent disconnect"
    fi

    local agent_id="${AGENT_ID:-}"
    if [ -z "$agent_id" ]; then
        log_warn "AGENT_ID not set in config — will skip agent disconnect"
    fi

    CE_JOB_RUN_NAME="${CE_JOB_RUN_NAME:-}"

    # Disable detach traps — we want full teardown here.
    trap '' EXIT INT TERM

    setup_ibmcloud_env
    end_session "$api_base" "$agent_id"

    log_info "End-session complete"
    exit 0
}

# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
echo "=========================================="
echo "  Remote Bob — Code Engine Session Launcher"
echo "  Config: $CONFIG_FILE"
echo "=========================================="

if [ "$END_SESSION" = true ]; then
    run_end_session
fi

run_codeengine

log_info "Launcher exiting normally"
exit 0
