#!/bin/bash
# start.sh — Container startup script for Qiskit JupyterLab on Code Engine.
#
# 1. Reads Qiskit credentials from the secret mounted at /etc/qiskit-secret/
#    (keys: token, instance) and calls QiskitRuntimeService.save_account so
#    that the notebook can call QiskitRuntimeService() without arguments.
#    The secret is mounted at a neutral path so Qiskit writes its own
#    correctly-structured account file to $HOME/.qiskit/qiskit-ibm.json.
# 2. Starts JupyterLab on all interfaces with open origin policy.
#
# Runs as the container user defined by NB_USER (default: dev).

set -euo pipefail

# The CE secret holding the Qiskit credentials is mounted at /etc/qiskit-secret/.
# Each key in the secret becomes a file; we have one key: qiskit-ibm.json.
CREDS_FILE="/etc/qiskit-secret/qiskit-ibm.json"

if [[ -f "$CREDS_FILE" ]]; then
  echo "[start] Registering Qiskit IBM Runtime credentials from $CREDS_FILE…"
  python3 - "$CREDS_FILE" <<'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    creds = json.load(f)

from qiskit_ibm_runtime import QiskitRuntimeService
QiskitRuntimeService.save_account(
    token=creds["token"],
    instance=creds.get("instance"),
    channel="ibm_quantum_platform",
    overwrite=True,
)
print("[start] Qiskit account saved.")
PYEOF
else
  echo "[start] Warning: $CREDS_FILE not found — skipping Qiskit account registration."
fi

echo "[start] Starting JupyterLab…"
exec jupyter lab \
  --ip="*" \
  --NotebookApp.allow_origin="*"
