#!/bin/bash
# ---------------------------------------------------------------------------
# Fleet task entrypoint — data enrichment worker
#
# Receives input as a single JSON string in $1, serialised by the CE Function.
# The fleet add_tasks call looks like:
#
#   { "idx": "<task_id>", "args": ["{\"key\":\"value\",...}"] }
#
# The container receives this as:  entrypoint.sh '{"key":"value",...}'
# so the entire payload is available as $1 with no parsing needed.
#
# Output JSON written to COS mount:
#   ${RESULTS_DIR}/interactive-fleet-result/${task_id}.json
#
# Output schema:
#   {
#     "task_id":         "<uuid>",
#     "status":          "completed",
#     "elapsed_seconds": 0.123,
#     "enriched_at":     "2025-01-15T12:00:00Z",
#     "processing_node": "<hostname>",
#     "input":           { ...original caller fields (task_id stripped)... },
#     "output": {
#       "word_count":    42,
#       "char_count":    210,
#       "reversed_keys": ["key3","key2","key1"],
#       "summary":       "Enriched N field(s) from input."
#     }
#   }
#
# Exit codes:
#   0 — task completed; result file written
#   1 — task failed (error printed to stderr)
# ---------------------------------------------------------------------------
set -eo pipefail

RESULTS_DIR="${RESULTS_DIR:-/data/results}"
COS_PREFIX="interactive-fleet-result"

START_NS=$(date +%s%N)

# ---------------------------------------------------------------------------
# 1. Read input JSON from $1
#    The function passes the entire payload as a single JSON string argument.
# ---------------------------------------------------------------------------
if [[ $# -lt 1 || -z "$1" ]]; then
    echo "[task] ERROR: no input JSON provided as \$1" >&2
    exit 1
fi

INPUT_JSON="$1"
echo "[task] Received input: ${INPUT_JSON}" >&2

# Validate it is parseable JSON
if ! jq -e . > /dev/null 2>&1 <<< "${INPUT_JSON}"; then
    echo "[task] ERROR: \$1 is not valid JSON: ${INPUT_JSON}" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# 2. Resolve task_id from the JSON payload or fall back to CE env vars / uuidgen
# ---------------------------------------------------------------------------
TASK_ID=$(jq -r '(.task_id // "") | select(. != "")' <<< "${INPUT_JSON}" || true)
TASK_ID="${TASK_ID:-${CE_TASK_INDEX:-}}"
TASK_ID="${TASK_ID:-${CE_TASK_ID:-}}"
TASK_ID="${TASK_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"

echo "[task] Processing task_id=${TASK_ID}" >&2

# ---------------------------------------------------------------------------
# 3. Build the clean input object (strip internal routing keys)
# ---------------------------------------------------------------------------
CLEAN_INPUT=$(jq 'del(.task_id)' <<< "${INPUT_JSON}")

# ---------------------------------------------------------------------------
# 4. Compute enrichment values
# ---------------------------------------------------------------------------

# Concatenate all string values for word/char counting
ALL_TEXT=$(jq -r '[to_entries[] | .value | tostring] | join(" ")' <<< "${CLEAN_INPUT}")
WORD_COUNT=$(echo "${ALL_TEXT}" | wc -w | tr -d ' ')
CHAR_COUNT=${#ALL_TEXT}
FIELD_COUNT=$(jq 'length' <<< "${CLEAN_INPUT}")

# Reversed key list as a JSON array
REVERSED_KEYS=$(jq '[keys_unsorted | reverse[]]' <<< "${CLEAN_INPUT}")

SUMMARY="Enriched ${FIELD_COUNT} field(s) from input."

# ---------------------------------------------------------------------------
# 5. Compute elapsed time (seconds with 4 decimal places)
# ---------------------------------------------------------------------------
END_NS=$(date +%s%N)
# Pure bash integer arithmetic — no awk needed
_ELAPSED_NS=$(( END_NS - START_NS ))
_ELAPSED_S=$(( _ELAPSED_NS / 1000000000 ))
_ELAPSED_MS=$(( (_ELAPSED_NS % 1000000000) / 100000 ))
ELAPSED=$(printf "%d.%04d" "${_ELAPSED_S}" "${_ELAPSED_MS}")

# ---------------------------------------------------------------------------
# 6. Assemble the result JSON
# ---------------------------------------------------------------------------
ENRICHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Read hostname from /etc/hostname — no external binary needed on ubi-minimal
PROCESSING_NODE=$(cat /etc/hostname 2>/dev/null || echo "unknown")

# Use --arg (string) for numeric values then convert with tonumber inside jq,
# avoiding --argjson failures when shell produces non-JSON-safe strings.
RESULT=$(jq -n \
    --arg     task_id         "${TASK_ID}" \
    --arg     enriched_at     "${ENRICHED_AT}" \
    --arg     processing_node "${PROCESSING_NODE}" \
    --arg     elapsed         "${ELAPSED}" \
    --argjson input           "${CLEAN_INPUT}" \
    --arg     word_count      "${WORD_COUNT}" \
    --arg     char_count      "${CHAR_COUNT}" \
    --argjson reversed_keys   "${REVERSED_KEYS}" \
    --arg     summary         "${SUMMARY}" \
    '{
        task_id:         $task_id,
        status:          "completed",
        elapsed_seconds: ($elapsed | tonumber),
        enriched_at:     $enriched_at,
        processing_node: $processing_node,
        input:           $input,
        output: {
            word_count:    ($word_count | tonumber),
            char_count:    ($char_count | tonumber),
            reversed_keys: $reversed_keys,
            summary:       $summary
        }
    }')

# ---------------------------------------------------------------------------
# 7. Write result to COS mount
#    Path: /data/results/interactive-fleet-result/<task_id>.json
# ---------------------------------------------------------------------------
mkdir -p "${RESULTS_DIR}/${COS_PREFIX}"
OUT_PATH="${RESULTS_DIR}/${COS_PREFIX}/${TASK_ID}.json"
echo "${RESULT}" > "${OUT_PATH}"

echo "[task] Done. Result written to ${OUT_PATH}" >&2
echo "${RESULT}"
