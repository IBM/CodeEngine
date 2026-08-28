#!/bin/bash
# Remote Bob — Code Engine launcher
#
# Usage:
#   cp .env.template .env          # one-time: fill in BOBSHELL_API_KEY, GATEWAY_PASSWORD, IBMCLOUD_API_KEY
#   ./run.sh                       # start / reconnect
#   ./run.sh --end-session         # tear down the running session
#   ./run.sh --help
#
# All config is read from .env (default) or the file passed via --config.
# Session state (AGENT_ID, API_SERVER_URL, CE_JOB_RUN_NAME) is persisted
# back into the config file so reconnects and --end-session work without
# extra arguments.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../ai/common.sh"

# ── Paths ─────────────────────────────────────────────────────────────────────
APISERVER_DIR="$SCRIPT_DIR/apiserver"
BROWSER_HTML="$SCRIPT_DIR/browser-client/single-session.html"

# ── Argument parsing ──────────────────────────────────────────────────────────
CONFIG_FILE="$SCRIPT_DIR/.env"
END_SESSION=false

for arg in "$@"; do
    case "$arg" in
        --config=*) CONFIG_FILE="${arg#--config=}" ;;
        --end-session) END_SESSION=true ;;
        --help|-h)
            cat <<EOF
Remote Bob — Code Engine Session Launcher

Usage:
  $0 [--config=FILE] [--end-session] [--help]

Options:
  --config=FILE    Config file (default: .env next to run.sh)
  --end-session    Terminate the running session
  --help           Show this help

Required config keys:
  BOBSHELL_API_KEY    Bob Shell API key (https://bob.ibm.com)
  GATEWAY_PASSWORD    Basic-auth password for the browser login
  IBMCLOUD_API_KEY    IBM Cloud API key (not needed for --end-session)

Session state written by run.sh (do not edit):
  AGENT_ID, API_SERVER_URL, CE_JOB_RUN_NAME
EOF
            exit 0
            ;;
        *) print_error "Unknown argument: $arg"; exit 2 ;;
    esac
done

[ -f "$CONFIG_FILE" ] || { print_error "Config file not found: $CONFIG_FILE"; exit 1; }

# ── Load config (shell env takes precedence over file) ────────────────────────
while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"; val="${line#*=}"
    [[ -z "${!key:-}" ]] && export "$key=$val"
done < "$CONFIG_FILE"

# ── Validate required variables ───────────────────────────────────────────────
check_var() { [[ -n "${!1:-}" ]] || { print_error "Missing required config: $1"; exit 1; }; }
check_var BOBSHELL_API_KEY
check_var GATEWAY_PASSWORD
[[ "$END_SESSION" == true ]] || check_var IBMCLOUD_API_KEY

# ── Defaults ──────────────────────────────────────────────────────────────────
CE_REGION="${CE_REGION:-us-east}"
CE_PROJECT="${CE_PROJECT:-remote-bob--ce-project}"
RESOURCE_GROUP="${RESOURCE_GROUP:-remote-bob--rg}"
APISERVER_APP_NAME="${APISERVER_APP_NAME:-remote-bob-apiserver}"
JOB_NAME="${JOB_NAME:-remote-bob-job-agent}"
CE_CONFIGMAP_NAME="${CE_CONFIGMAP_NAME:-remote-bob-config}"
DEFAULT_CPU="${DEFAULT_CPU:-1}"
DEFAULT_MEMORY="${DEFAULT_MEMORY:-2G}"
DEFAULT_TIMEOUT="${DEFAULT_TIMEOUT:-86400}"
CE_CLEANUP_APP="${CE_CLEANUP_APP:-delete}"
CHROME_DEBUG_PORT="${CHROME_DEBUG_PORT:-}"

# Cap job timeout at the CE hard limit.
(( DEFAULT_TIMEOUT > 86400 )) && DEFAULT_TIMEOUT=86400

# ── Credential generation (first run only) ────────────────────────────────────
ensure_credential() {
    local key="$1" cmd="$2"
    if [[ -z "${!key:-}" ]]; then
        local val; val="$(eval "$cmd")"
        export "$key=$val"
        echo "${key}=${val}" >> "$CONFIG_FILE"
        print_msg "Generated $key"
    fi
}
ensure_credential GATEWAY_TOKEN  'openssl rand -hex 16'
ensure_credential ENCRYPTION_KEY 'openssl rand -base64 32'

# ── Config persistence helper ─────────────────────────────────────────────────
save() {
    local key="$1" val="$2"
    if grep -q "^${key}=" "$CONFIG_FILE" 2>/dev/null; then
        sed -i '' "s|^${key}=.*|${key}=${val}|" "$CONFIG_FILE"
    else
        echo "${key}=${val}" >> "$CONFIG_FILE"
    fi
}

# ── Auth helper ───────────────────────────────────────────────────────────────
auth_header() { echo "Basic $(echo -n "admin:${GATEWAY_PASSWORD}" | base64)"; }

# ── IBM Cloud setup ───────────────────────────────────────────────────────────
ibmcloud_setup() {
    command -v ibmcloud &>/dev/null || { print_error "ibmcloud CLI not found"; exit 1; }
    command -v jq      &>/dev/null || { print_error "jq not found"; exit 1; }

    ensure_plugin_is_up_to_date code-engine

    print_msg "\nLogging in to IBM Cloud (region: $CE_REGION, resource group: $RESOURCE_GROUP)"
    ibmcloud login --apikey "$IBMCLOUD_API_KEY" -r "$CE_REGION" -g "$RESOURCE_GROUP" -q 2>/dev/null || {
        ibmcloud login --apikey "$IBMCLOUD_API_KEY" -r "$CE_REGION" -q
        ibmcloud resource group $RESOURCE_GROUP -q 2>/dev/null || ibmcloud resource group-create "$RESOURCE_GROUP"
        ibmcloud target -g "$RESOURCE_GROUP" -q
    }

    print_msg "\nEnsuring Code Engine project '$CE_PROJECT'"
    if ! ibmcloud ce project select --name "$CE_PROJECT" -q 2>/dev/null; then
        ibmcloud ce project create --name "$CE_PROJECT"
        ibmcloud ce project select --name "$CE_PROJECT" -q
    fi
}

# ── Provision CE secrets + configmap (idempotent) ─────────────────────────────
provision() {
    print_msg "\nProvisioning CE secrets and configmap"
    local project_id
    project_id="$(ibmcloud ce project current --output json | jq -r '.guid')"

    upsert_secret() {
        local name="$1"; shift
        if ibmcloud ce secret get --name "$name" &>/dev/null; then
            ibmcloud ce secret update --name "$name" "$@" -q
        else
            ibmcloud ce secret create --name "$name" "$@" -q
        fi
    }

    upsert_secret remote-bob-gateway \
        --from-literal gateway-token="$GATEWAY_TOKEN" \
        --from-literal gateway-password="$GATEWAY_PASSWORD" \
        --from-literal encryption-key="$ENCRYPTION_KEY"

    upsert_secret remote-bob-ibmcloud --from-literal api-key="$IBMCLOUD_API_KEY"
    upsert_secret remote-bob-bobshell --from-literal api-key="$BOBSHELL_API_KEY"

    if ibmcloud ce configmap get --name "$CE_CONFIGMAP_NAME" &>/dev/null; then
        ibmcloud ce configmap update --name "$CE_CONFIGMAP_NAME" \
            --from-literal CE_PROJECT_ID="$project_id" \
            --from-literal CE_REGION="$CE_REGION" \
            --from-literal CE_JOB_NAME="$JOB_NAME" \
            --from-literal LOG_LEVEL="info" \
            --from-literal LOCAL_MODE="false" -q
    else
        ibmcloud ce configmap create --name "$CE_CONFIGMAP_NAME" \
            --from-literal CE_PROJECT_ID="$project_id" \
            --from-literal CE_REGION="$CE_REGION" \
            --from-literal CE_JOB_NAME="$JOB_NAME" \
            --from-literal LOG_LEVEL="info" \
            --from-literal LOCAL_MODE="false" -q
    fi
}

# ── Deploy / update the apiserver application ─────────────────────────────────
deploy_apiserver() {
    print_msg "\nDeploying apiserver app '$APISERVER_APP_NAME'"
    if ibmcloud ce application get --name "$APISERVER_APP_NAME" &>/dev/null; then
        ibmcloud ce application update \
            --name "$APISERVER_APP_NAME" \
            --build-source "$APISERVER_DIR" \
            --min-scale 0 --wait
    else
        ibmcloud ce application create \
            --name "$APISERVER_APP_NAME" \
            --build-source "$APISERVER_DIR" \
            --port 8080 --min-scale 0 --max-scale 20 \
            --cpu 0.5 --memory 1G --concurrency 100 \
            --env-from-configmap "$CE_CONFIGMAP_NAME" \
            --mount-secret "/secrets/gateway=remote-bob-gateway" \
            --mount-secret "/secrets/ibmcloud=remote-bob-ibmcloud" \
            --wait
    fi
}

# ── Deploy the job-agent job (delete+recreate when stale) ─────────────────────
deploy_job_agent() {
    local gateway_url="$1"
    local gateway_wss="${gateway_url/https:/wss:}/ws"

    if ibmcloud ce job get --name "$JOB_NAME" &>/dev/null; then
        # Refresh GATEWAY_WSS if changed; otherwise skip rebuild.
        local current_wss
        current_wss="$(ibmcloud ce job get --name "$JOB_NAME" --output json \
            | jq -r '[.spec.template.containers[0].env[]? | select(.name=="GATEWAY_WSS") | .value][0] // empty')"
        if [[ "$current_wss" == "$gateway_wss" ]]; then
            print_msg "\nJob '$JOB_NAME' is current — skipping rebuild"
            return
        fi
        print_msg "\nGateway URL changed — recreating job '$JOB_NAME'"
        ibmcloud ce job delete --name "$JOB_NAME" --force -q
    fi

    print_msg "\nCreating job '$JOB_NAME'"
    ibmcloud ce job create \
        --name "$JOB_NAME" \
        --build-source "$SCRIPT_DIR" \
        --build-dockerfile "job-agent/Dockerfile" \
        --mode task \
        --cpu "$DEFAULT_CPU" --memory "$DEFAULT_MEMORY" \
        --maxexecutiontime "$DEFAULT_TIMEOUT" \
        --retrylimit 0 \
        --env "GATEWAY_WSS=$gateway_wss" \
        --env "LOG_LEVEL=info" \
        --mount-secret "/secrets/gateway=remote-bob-gateway" \
        --mount-secret "/secrets/bobshell=remote-bob-bobshell"
}

# ── Wait for agent to report "ready" ─────────────────────────────────────────
wait_for_agent() {
    local api_base="$1" agent_id="$2" timeout="${3:-480}" elapsed=0
    print_msg "\nWaiting for agent $agent_id (up to ${timeout}s)..."
    while (( elapsed < timeout )); do
        local status
        status="$(curl -sf "${api_base}/agents" \
            -H "Authorization: $(auth_header)" 2>/dev/null \
            | jq -r --arg id "$agent_id" '.[] | select(.agent_id==$id) | .status // empty' 2>/dev/null || true)"
        [[ "$status" == "ready" ]] && { print_success "\nAgent ready after ${elapsed}s"; return 0; }
        sleep 3; elapsed=$(( elapsed + 3 ))
    done
    print_error "Agent $agent_id not ready after ${timeout}s"
    ibmcloud ce jobrun logs --name "$CE_JOB_RUN_NAME" 2>/dev/null | tail -40 || true
    return 1
}

# ── Reconnect check ───────────────────────────────────────────────────────────
session_is_live() {
    [[ -n "${AGENT_ID:-}" && -n "${API_SERVER_URL:-}" ]] || return 1
    local base="${API_SERVER_URL%/}"
    curl -sf -o /dev/null "${base}/healthz" 2>/dev/null || return 1
    local status
    status="$(curl -sf "${base}/agents" -H "Authorization: $(auth_header)" 2>/dev/null \
        | jq -r --arg id "$AGENT_ID" '.[] | select(.agent_id==$id) | .status // empty' 2>/dev/null || true)"
    [[ "$status" == "ready" ]]
}

# ── Launch Chrome ─────────────────────────────────────────────────────────────
launch_chrome() {
    local api_host="${API_SERVER_URL#https://}"; api_host="${api_host#http://}"
    local url="file://${BROWSER_HTML}?apiHost=${api_host}&agent=${AGENT_ID}"
    local user_data; user_data="$(mktemp -d "$SCRIPT_DIR/tmp/remote-bob-chrome.XXXXXX")"

    local chrome_bin
    chrome_bin="$(command -v google-chrome || command -v google-chrome-stable || true)"
    [[ -n "$chrome_bin" ]] || { print_error "google-chrome not found in PATH"; exit 1; }
    [[ -f "$BROWSER_HTML" ]]  || { print_error "Browser client not found: $BROWSER_HTML"; exit 1; }

    mkdir -p "$SCRIPT_DIR/tmp"
    local args=( --app="$url" --user-data-dir="$user_data" --new-window
                 --no-first-run --no-default-browser-check
                 --disable-extensions --disable-sync --disable-translate )
    [[ -n "$CHROME_DEBUG_PORT" ]] && args+=( "--remote-debugging-port=$CHROME_DEBUG_PORT" )

    print_success "\nSession live — opening browser"
    print_msg "  Agent:  $AGENT_ID"
    print_msg "  API:    ${API_SERVER_URL}"
    print_msg "\nClose the window to detach. Session continues in the background."
    print_msg "Run './run.sh --end-session' to terminate.\n"

    "$chrome_bin" "${args[@]}" >/dev/null 2>&1 &
    local pid=$!
    # Detach cleanly: clean up the temp dir when Chrome exits.
    wait "$pid" 2>/dev/null || true
    rm -rf "$user_data"
}

# ═════════════════════════════════════════════════════════════════════════════
# --end-session
# ═════════════════════════════════════════════════════════════════════════════
if [[ "$END_SESSION" == true ]]; then
    print_msg "\n========== Remote Bob — End Session =========="

    # Disconnect agent (best effort — server may already be down).
    if [[ -n "${API_SERVER_URL:-}" && -n "${AGENT_ID:-}" ]]; then
        print_msg "\nDisconnecting agent $AGENT_ID"
        curl -sf -X DELETE "${API_SERVER_URL%/}/agents/${AGENT_ID}" \
            -H "Authorization: $(auth_header)" 2>/dev/null || true
    fi

    ibmcloud_setup

    [[ -n "${CE_JOB_RUN_NAME:-}" ]] && \
        ibmcloud ce jobrun delete --name "$CE_JOB_RUN_NAME" --force 2>/dev/null || true

    if [[ "$CE_CLEANUP_APP" == "stop" ]]; then
        ibmcloud ce application update --name "$APISERVER_APP_NAME" \
            --min-scale 0 --max-scale 0 2>/dev/null || true
    else
        ibmcloud ce application delete --name "$APISERVER_APP_NAME" --force 2>/dev/null || true
    fi

    print_success "\n========== Session ended ==========\n"
    exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# START / RECONNECT
# ═════════════════════════════════════════════════════════════════════════════
print_msg "\n========== Remote Bob — Code Engine =========="

# Reconnect without re-provisioning if a session is already live.
if session_is_live; then
    print_msg "\nReconnecting to existing session (agent: $AGENT_ID)"
    launch_chrome
    exit 0
fi

ibmcloud_setup
provision

deploy_apiserver

# Get the app URL (available immediately after deploy).
API_SERVER_URL="$(ibmcloud ce application get --name "$APISERVER_APP_NAME" --output json \
    | jq -r '.status.url // empty')"
[[ -n "$API_SERVER_URL" ]] || { print_error "Could not determine apiserver URL"; exit 1; }
API_SERVER_URL="${API_SERVER_URL%/}"
save API_SERVER_URL "$API_SERVER_URL"

deploy_job_agent "$API_SERVER_URL"

# Wait for the app to serve requests.
print_msg "\nWaiting for apiserver health check..."
for i in $(seq 1 60); do
    curl -sf -o /dev/null "${API_SERVER_URL}/healthz" 2>/dev/null && break
    sleep 2
done
curl -sf -o /dev/null "${API_SERVER_URL}/healthz" || { print_error "Apiserver not healthy"; exit 1; }

# Generate a unique agent ID and issue a run token.
AGENT_ID="agent-$(openssl rand -hex 8)"
save AGENT_ID "$AGENT_ID"

RUN_TOKEN="$(curl -sf -X POST "${API_SERVER_URL}/auth/runs?agent=${AGENT_ID}" \
    -H "Authorization: $(auth_header)" | jq -r '.run_token // empty')"
[[ -n "$RUN_TOKEN" ]] || { print_error "POST /auth/runs returned no run_token"; exit 1; }

# Submit the job run.
CE_JOB_RUN_NAME="${JOB_NAME}-${AGENT_ID#agent-}"
save CE_JOB_RUN_NAME "$CE_JOB_RUN_NAME"

ibmcloud ce jobrun submit \
    --name "$CE_JOB_RUN_NAME" \
    --job "$JOB_NAME" \
    --mode task \
    --env "AGENT_ID=$AGENT_ID" \
    --env "RUN_TOKEN=$RUN_TOKEN" \
    --cpu "$DEFAULT_CPU" \
    --memory "$DEFAULT_MEMORY" \
    --maxexecutiontime "$DEFAULT_TIMEOUT"

wait_for_agent "$API_SERVER_URL" "$AGENT_ID" 480 || exit 1

launch_chrome

print_success "\nDone.\n"
