#!/usr/bin/env bash
# setup.sh — Idempotent provisioning script for Qiskit JupyterLab on Code Engine.
#
# Usage:
#   ./setup.sh                        # sources setup.env.local automatically
#   ENV_FILE=my.env ./setup.sh        # use a custom env file
#   NAME_PREFIX=my-lab ./setup.sh     # override any variable from the shell
#
# The script sources the env file with 'set -a' so every variable is
# automatically exported and visible to all subprocesses.
#
# Resource names are derived from NAME_PREFIX plus a random 4-character suffix.
# The suffix is non-deterministic: every run generates a new one and therefore
# creates a new set of resources. To reuse an existing set (e.g. to re-run the
# script), export NAME_SUFFIX=<suffix> before running. The random suffix keeps
# the globally unique COS bucket name collision-free.
# Every derived name (resource group, COS, Code Engine) can be overridden by
# exporting the variable before running the script, see the section below.

set -euo pipefail

# ── load configuration ────────────────────────────────────────────────────────

ENV_FILE="${ENV_FILE:-setup.env.local}"
if [[ -f "$ENV_FILE" ]]; then
  set -a          # auto-export every variable that is set
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
else
  # Env file missing — variables must already be exported in the environment.
  echo "[setup] Note: '$ENV_FILE' not found; expecting variables to be pre-exported."
fi

# ── helpers ──────────────────────────────────────────────────────────────────

log()  { echo "[setup] $*"; }
info() { echo "[setup] ✓ $*"; }
err()  { echo "[setup] ✗ $*" >&2; exit 1; }

# ce_exists <resource-type> <name>
# Returns 0 if the resource exists, 1 otherwise.
ce_exists() {
  ibmcloud ce "$1" get --name "$2" --output json >/dev/null 2>&1
}

# ── validate required variables ──────────────────────────────────────────────

NAME_PREFIX="${NAME_PREFIX:-ce-qiskit-jupyterlab}"

# IBMCLOUD_API_KEY is optional: when it is empty, step 1 logs in with 'ibmcloud login --sso'.
required_vars=(
  IBMCLOUD_REGION
  QISKIT_IBM_TOKEN QISKIT_IBM_INSTANCE
  JUPYTER_TOKEN
)

for var in "${required_vars[@]}"; do
  [[ -z "${!var:-}" ]] && err "Required variable \$$var is not set. Source setup.env.local first."
done

# The prefix ends up in COS bucket and Code Engine names: lowercase letters,
# digits and dashes, starting with a letter, at most 40 characters.
[[ "$NAME_PREFIX" =~ ^[a-z]([a-z0-9-]{0,38}[a-z0-9])?$ ]] \
  || err "NAME_PREFIX '$NAME_PREFIX' is invalid: use lowercase letters, digits and dashes (start with a letter, max 40 characters)."

# ── 1. IBM Cloud login ────────────────────────────────────────────────────────

if [[ -n "${IBMCLOUD_API_KEY:-}" ]]; then
  log "Logging in to IBM Cloud with API key (region: $IBMCLOUD_REGION)…"
  ibmcloud login \
    --apikey "$IBMCLOUD_API_KEY" \
    -r       "$IBMCLOUD_REGION" \
    --quiet
else
  log "IBMCLOUD_API_KEY is not set — logging in with SSO (region: $IBMCLOUD_REGION)…"
  log "Open the URL printed below in a browser and enter the one-time passcode."
  ibmcloud login --sso -r "$IBMCLOUD_REGION"
fi
info "Logged in."

# ── 1a. Derive resource names ─────────────────────────────────────────────────

# Random 4-character suffix (hex), different on every run unless NAME_SUFFIX is set.
if [[ -z "${NAME_SUFFIX:-}" ]]; then
  printf -v NAME_SUFFIX '%04x' $(( (RANDOM << 1) | (RANDOM & 1) ))   # 16 random bits
fi
NAME_BASE="${NAME_PREFIX}-${NAME_SUFFIX}"

# Each name can be overridden by exporting the variable before running the script.
IBMCLOUD_RESOURCE_GROUP_NAME="${IBMCLOUD_RESOURCE_GROUP_NAME:-$NAME_BASE}"
COS_INSTANCE_NAME="${COS_INSTANCE_NAME:-${NAME_BASE}-cos}"
COS_BUCKET_NAME="${COS_BUCKET_NAME:-${NAME_BASE}-notebooks}"
COS_BUCKET_LOCATION="${COS_BUCKET_LOCATION:-$IBMCLOUD_REGION}"
COS_SERVICE_KEY_NAME="${COS_SERVICE_KEY_NAME:-${NAME_BASE}-cos-key}"
CE_PROJECT_NAME="${CE_PROJECT_NAME:-$NAME_BASE}"
CE_APP_NAME="${CE_APP_NAME:-$NAME_BASE}"
CE_HMAC_SECRET_NAME="${CE_HMAC_SECRET_NAME:-${NAME_BASE}-cos-hmac}"
CE_PDS_NAME="${CE_PDS_NAME:-${NAME_BASE}-notebooks-pds}"
CE_QISKIT_SECRET_NAME="${CE_QISKIT_SECRET_NAME:-${NAME_BASE}-qiskit}"

log "Resource names (prefix '$NAME_PREFIX', suffix '$NAME_SUFFIX'):"
log "  resource group : $IBMCLOUD_RESOURCE_GROUP_NAME"
log "  COS instance   : $COS_INSTANCE_NAME"
log "  COS bucket     : $COS_BUCKET_NAME ($COS_BUCKET_LOCATION)"
log "  COS credential : $COS_SERVICE_KEY_NAME"
log "  CE project     : $CE_PROJECT_NAME"
log "  CE application : $CE_APP_NAME"
log "  CE secrets     : $CE_HMAC_SECRET_NAME, $CE_QISKIT_SECRET_NAME"
log "  CE data store  : $CE_PDS_NAME"

# ── 1b. Resource group ────────────────────────────────────────────────────────

log "Checking resource group '$IBMCLOUD_RESOURCE_GROUP_NAME'…"
if ibmcloud resource group "$IBMCLOUD_RESOURCE_GROUP_NAME" --output json >/dev/null 2>&1; then
  info "Resource group already exists — skipping create."
else
  log "Creating resource group '$IBMCLOUD_RESOURCE_GROUP_NAME'…"
  ibmcloud resource group-create "$IBMCLOUD_RESOURCE_GROUP_NAME"
  info "Resource group created."
fi

# Switch the CLI context to the new resource group so all subsequent commands use it.
ibmcloud target -g "$IBMCLOUD_RESOURCE_GROUP_NAME" --quiet
info "Targeted resource group '$IBMCLOUD_RESOURCE_GROUP_NAME'."

# ── 2. Ensure plugins are installed ──────────────────────────────────────────

log "Ensuring ibmcloud plugins are installed…"
ibmcloud plugin install code-engine          -f --quiet 2>/dev/null || true
ibmcloud plugin install cloud-object-storage -f --quiet 2>/dev/null || true
info "Plugins ready."

# ── 3. COS service instance ───────────────────────────────────────────────────

log "Checking COS service instance '$COS_INSTANCE_NAME'…"
if ibmcloud resource service-instance "$COS_INSTANCE_NAME" --output json >/dev/null 2>&1; then
  info "COS instance already exists — skipping create."
else
  log "Creating COS service instance '$COS_INSTANCE_NAME'…"
  ibmcloud resource service-instance-create \
    "$COS_INSTANCE_NAME" \
    cloud-object-storage \
    standard \
    global \
    -d premium-global-deployment-iam
  info "COS instance created."
fi

# Retrieve the COS instance CRN and configure the COS CLI plugin.
COS_INSTANCE_CRN=$(ibmcloud resource service-instance "$COS_INSTANCE_NAME" --output json \
  | jq -r '.[0].id')
ibmcloud cos config crn --crn "$COS_INSTANCE_CRN" --force
# Set the regional endpoint explicitly so the plugin never falls back to a
# stale cached endpoint (e.g. from a previous region).
ibmcloud cos config endpoint-url --url "https://s3.$COS_BUCKET_LOCATION.cloud-object-storage.appdomain.cloud"
info "COS CLI configured for instance CRN and endpoint."

# ── 3b. COS service credential (HMAC) ─────────────────────────────────────────

log "Checking COS service credential '$COS_SERVICE_KEY_NAME'…"
if ibmcloud resource service-key "$COS_SERVICE_KEY_NAME" --output json >/dev/null 2>&1; then
  info "COS service credential already exists — reusing."
else
  log "Creating COS service credential '$COS_SERVICE_KEY_NAME' with HMAC enabled…"
  ibmcloud resource service-key-create \
    "$COS_SERVICE_KEY_NAME" \
    Writer \
    --instance-name "$COS_INSTANCE_NAME" \
    -p '{"HMAC":true}'
  info "COS service credential created."
fi

# Extract HMAC keys from the credential JSON — no manual copy needed.
COS_HMAC_CREDENTIALS=$(ibmcloud resource service-key "$COS_SERVICE_KEY_NAME" --output json)
COS_HMAC_ACCESS_KEY_ID=$(echo "$COS_HMAC_CREDENTIALS"|jq -r '.[0].credentials.cos_hmac_keys.access_key_id')
COS_HMAC_SECRET_ACCESS_KEY=$(echo "$COS_HMAC_CREDENTIALS"|jq -r '.[0].credentials.cos_hmac_keys.secret_access_key')
info "HMAC keys extracted from service credential."

# ── 4. COS bucket ─────────────────────────────────────────────────────────────

log "Checking COS bucket '$COS_BUCKET_NAME'…"
if ibmcloud cos bucket-head --bucket "$COS_BUCKET_NAME" --region "$COS_BUCKET_LOCATION" >/dev/null 2>&1; then
  info "COS bucket already exists — skipping create."
else
  log "Creating COS bucket '$COS_BUCKET_NAME' in '$COS_BUCKET_LOCATION'…"
  ibmcloud cos bucket-create \
    --bucket                  "$COS_BUCKET_NAME" \
    --region                  "$COS_BUCKET_LOCATION" \
    --ibm-service-instance-id "$COS_INSTANCE_CRN"
  info "COS bucket created."
fi

# ── 5. Code Engine project ────────────────────────────────────────────────────

log "Checking Code Engine project '$CE_PROJECT_NAME'…"
if ibmcloud ce project get --name "$CE_PROJECT_NAME" --output json >/dev/null 2>&1; then
  info "Code Engine project already exists — skipping create."
else
  log "Creating Code Engine project '$CE_PROJECT_NAME'…"
  ibmcloud ce project create --name "$CE_PROJECT_NAME"
  info "Code Engine project created."
fi

log "Selecting Code Engine project '$CE_PROJECT_NAME'…"
ibmcloud ce project select --name "$CE_PROJECT_NAME"
info "Project selected."

# ── 6. HMAC secret ────────────────────────────────────────────────────────────

log "Checking HMAC secret '$CE_HMAC_SECRET_NAME'…"
if ce_exists secret "$CE_HMAC_SECRET_NAME"; then
  info "HMAC secret already exists — skipping create."
else
  log "Creating HMAC secret '$CE_HMAC_SECRET_NAME'…"
  ibmcloud ce secret create \
    --name              "$CE_HMAC_SECRET_NAME" \
    --format            hmac \
    --access-key-id     "$COS_HMAC_ACCESS_KEY_ID" \
    --secret-access-key "$COS_HMAC_SECRET_ACCESS_KEY"
  info "HMAC secret created."
fi

# ── 7. Persistent data store ──────────────────────────────────────────────────

log "Checking persistent data store '$CE_PDS_NAME'…"
if ibmcloud ce persistentdatastore get --name "$CE_PDS_NAME" --output json >/dev/null 2>&1; then
  info "Persistent data store already exists — skipping create."
else
  log "Creating persistent data store '$CE_PDS_NAME'…"
  ibmcloud ce persistentdatastore create \
    --name              "$CE_PDS_NAME" \
    --cos-bucket-name   "$COS_BUCKET_NAME" \
    --cos-access-secret "$CE_HMAC_SECRET_NAME"
  info "Persistent data store created."
fi

# ── 8. Qiskit credentials secret ─────────────────────────────────────────────

# Write credentials to a temp file; always clean it up on exit.
TMPFILE=$(mktemp /tmp/qiskit-ibm-XXXXXX.json)
trap 'rm -f "$TMPFILE"' EXIT

jq -n \
  --arg token    "$QISKIT_IBM_TOKEN" \
  --arg instance "$QISKIT_IBM_INSTANCE" \
  '{token: $token, instance: $instance}' > "$TMPFILE"

log "Checking Qiskit credentials secret '$CE_QISKIT_SECRET_NAME'…"
if ce_exists secret "$CE_QISKIT_SECRET_NAME"; then
  log "Updating existing Qiskit credentials secret…"
  ibmcloud ce secret update \
    --name       "$CE_QISKIT_SECRET_NAME" \
    --from-file  "qiskit-ibm.json=$TMPFILE"
  info "Qiskit credentials secret updated."
else
  log "Creating Qiskit credentials secret…"
  ibmcloud ce secret create \
    --name       "$CE_QISKIT_SECRET_NAME" \
    --format     generic \
    --from-file  "qiskit-ibm.json=$TMPFILE"
  info "Qiskit credentials secret created."
fi

# ── 9. Application create / update ───────────────────────────────────────────

# Flags shared between create and update.
APP_FLAGS=(
  --name             "$CE_APP_NAME"
  --source           "."
  --strategy         dockerfile
  --size             xlarge
  --port             8888
  --min-scale        1
  --max-scale        1
  --scale-down-delay 600
  --cpu              1
  --memory           4G
  --service-account  "none"
  --env              "JUPYTER_TOKEN=$JUPYTER_TOKEN"
)

# Flags only applied on create — mounts are set once at creation time and
# must not be passed on update (Code Engine preserves them across rebuilds).
CREATE_ONLY_FLAGS=(
  --mount-secret     "/etc/qiskit-secret=$CE_QISKIT_SECRET_NAME"
  --mount-data-store "/home/jovyan/work=$CE_PDS_NAME"
)

log "Checking application '$CE_APP_NAME'…"
if ce_exists app "$CE_APP_NAME"; then
  log "Application exists — updating (triggers a new build)…"
  ibmcloud ce app update "${APP_FLAGS[@]}"
  info "Application updated."
else
  log "Creating application '$CE_APP_NAME' (triggers a build from local source)…"
  ibmcloud ce app create "${APP_FLAGS[@]}" "${CREATE_ONLY_FLAGS[@]}"
  info "Application created."
fi

# ── 10. Print URL ─────────────────────────────────────────────────────────────

log "Waiting for application to be ready…"
ibmcloud ce app get --name "$CE_APP_NAME" --output url
