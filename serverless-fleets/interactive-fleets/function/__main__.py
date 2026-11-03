#!/usr/bin/env python3
"""
Code Engine Function — interactive-fleets dispatcher

A general-purpose submit-and-poll gateway for IBM Code Engine Fleets.
Accepts arbitrary JSON input, submits it as a fleet task, polls COS for the
result, and returns either the completed result (synchronous) or a retrieval
URL (asynchronous).

──────────────────────────────────────────────────────────────────────────────
Endpoints
──────────────────────────────────────────────────────────────────────────────

  POST /                      Submit a new task with a JSON body.
  GET  /                      Submit a new task with URL query parameters.
  GET  /result/{task_id}      Retrieve the result of a previously submitted task.

──────────────────────────────────────────────────────────────────────────────
Submit (POST / or GET /)
──────────────────────────────────────────────────────────────────────────────

  Any key/value pairs in the request body or query string are forwarded to the
  fleet task as its input. The function:

    1. Generates a unique task_id (UUID) — or uses a caller-supplied one.
    2. Obtains an IAM token from CE_API_KEY.
    3. Serialises the input dict (plus task_id) as a single JSON string and
       submits it to the CE Fleet via add_tasks with:
         { "idx": "<task_id>", "args": ["<json-string>"] }
       The task container receives the JSON string as $1 and reads it directly.
    4. Polls COS for {COS_PREFIX}/{task_id}.json for up to POLL_TIMEOUT seconds.
    5a. If the result is available → HTTP 200 with the result JSON.
    5b. If polling times out     → HTTP 202 with task_id and a retrieve_url.

  Reserved input keys (consumed by the function, not forwarded to the task):
    task_id       — custom task ID override
    poll_timeout  — override the server-side POLL_TIMEOUT for this request

──────────────────────────────────────────────────────────────────────────────
Retrieve (GET /result/{task_id})
──────────────────────────────────────────────────────────────────────────────

  Fetches {COS_PREFIX}/{task_id}.json from COS using the IAM token as Bearer.
    HTTP 200 — result available; body contains the result JSON.
    HTTP 404 — result not yet available (task still running or invalid ID).

──────────────────────────────────────────────────────────────────────────────
Required environment variables
──────────────────────────────────────────────────────────────────────────────

  FLEET_ID         — UUID or name of the target CE Fleet
  CE_API_KEY       — IBM Cloud API key (IAM token exchange — used for both CE Fleet API and COS)
  COS_BUCKET       — COS bucket name where task results are stored

──────────────────────────────────────────────────────────────────────────────
Optional environment variables
──────────────────────────────────────────────────────────────────────────────

  CE_API_BASE_URL  — CE API base URL (injected by CE runtime automatically)
  CE_PROJECT_ID    — CE project UUID (injected by CE runtime automatically)
  COS_ENDPOINT     — COS S3 endpoint (default: s3.direct.eu-de.cloud-object-storage.appdomain.cloud)
  COS_PREFIX       — Folder prefix inside the COS bucket (default: interactive-fleet-result)
  POLL_TIMEOUT     — Max seconds to poll COS before returning 202 (default: 30)
  POLL_INTERVAL    — Seconds between poll attempts (default: 2)
"""

import http.client
import json
import os
import re
import time
import urllib.parse
import uuid


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CE_API_BASE_URL = os.environ.get(
    "CE_API_BASE_URL",
    "https://api.private.eu-de.codeengine.cloud.ibm.com",
)
CE_PROJECT_ID = os.environ.get("CE_PROJECT_ID", "")
FLEET_ID      = os.environ.get("FLEET_ID", "")
CE_API_KEY    = os.environ.get("CE_API_KEY", "")

# Self-URL — used to build retrieve_url in async (202) responses
_CE_FUNCTION  = os.environ.get("CE_FUNCTION", "")
_CE_SUBDOMAIN = os.environ.get("CE_SUBDOMAIN", "")
_CE_DOMAIN    = os.environ.get("CE_DOMAIN", "")
FUNCTION_URL  = (
    f"https://{_CE_FUNCTION}.{_CE_SUBDOMAIN}.{_CE_DOMAIN}"
    if _CE_FUNCTION and _CE_SUBDOMAIN and _CE_DOMAIN
    else ""
)

# COS — accessed via IAM Bearer token derived from CE_API_KEY
COS_ENDPOINT = os.environ.get(
    "COS_ENDPOINT",
    "https://s3.direct.eu-de.cloud-object-storage.appdomain.cloud",
)
COS_BUCKET   = os.environ.get("COS_BUCKET", "fleet-output-store")
COS_PREFIX   = os.environ.get("COS_PREFIX", "interactive-fleet-result").strip("/")

POLL_TIMEOUT  = float(os.environ.get("POLL_TIMEOUT", "30.0"))
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "2.0"))

IAM_TOKEN_URL = "iam.cloud.ibm.com"

# Keys that are consumed by the function and not forwarded to the fleet task
_RESERVED_KEYS = {"task_id", "poll_timeout", "__ce_query", "__ce_path", "__ce_method"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_iam_token(api_key: str) -> str:
    """Exchange an IBM Cloud API key for an IAM bearer token."""
    body = urllib.parse.urlencode({
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": api_key,
    })
    conn = http.client.HTTPSConnection(IAM_TOKEN_URL, timeout=15)
    conn.request(
        "POST",
        "/identity/token",
        body,
        {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept":       "application/json",
        },
    )
    resp = conn.getresponse()
    data = json.loads(resp.read())
    conn.close()
    if resp.status != 200:
        raise RuntimeError(f"IAM token request failed ({resp.status}): {data}")
    return data["access_token"]


def _parse_url(url: str) -> tuple[str, int, bool]:
    """Return (host, port, use_https) from a URL string."""
    https = url.startswith("https://")
    url   = url.removeprefix("https://").removeprefix("http://")
    host, _, port_str = url.partition(":")
    if "/" in host:
        host = host.split("/")[0]
    port = int(port_str) if port_str else (443 if https else 80)
    return host, port, https


# ---------------------------------------------------------------------------
# CE Fleet API
# ---------------------------------------------------------------------------

def _add_fleet_task(
    api_base_url: str,
    project_id: str,
    fleet_id: str,
    iam_token: str,
    task_data: dict,
    task_idx: str,
) -> tuple[int, dict]:
    """
    POST /v2/projects/{project_id}/fleets/{fleet_id}/add_tasks?version=2025-07-10

    Submits a single task to the fleet.

    The entire task_data dict is serialised as a single JSON string and passed
    as args[0].  The task container reads it with:

        INPUT_JSON="$1"

    This avoids the fragile key-value argv convention and lets the container
    receive a fully-typed JSON payload without any shell parsing.

    JSONL task specification (one task):
        { "idx": "<task_id>", "args": ["<json-string>"] }

    CE add_tasks body:
        {
          "tasks_specification": {
            "json": [
              { "idx": "<task_id>", "args": ["<json-string>"] }
            ]
          }
        }
    """
    path = f"/v2/projects/{project_id}/fleets/{fleet_id}/add_tasks?version=2025-07-10"
    task_entry: dict = {
        "idx":  task_idx,
        "args": [json.dumps(task_data)],   # single arg: the full payload as JSON string
    }

    payload = {"tasks_specification": {"json": [task_entry]}}
    body    = json.dumps(payload)

    host, port, https = _parse_url(api_base_url)
    conn = (
        http.client.HTTPSConnection(host, port, timeout=20)
        if https
        else http.client.HTTPConnection(host, port, timeout=20)
    )
    conn.request(
        "POST",
        path,
        body,
        {
            "Content-Type":  "application/json",
            "Accept":        "application/json",
            "Authorization": f"Bearer {iam_token}",
        },
    )
    resp = conn.getresponse()
    data = resp.read()
    conn.close()
    return resp.status, json.loads(data) if data else {}


# ---------------------------------------------------------------------------
# COS access (IAM Bearer token)
# ---------------------------------------------------------------------------

def _get_cos_object(
    cos_endpoint: str,
    bucket: str,
    object_key: str,
    iam_token: str,
) -> tuple[int, dict | None, str]:
    """
    GET an object from COS via S3 REST API using an IAM Bearer token.
    IBM COS accepts IAM tokens directly as Authorization: Bearer <token>.
    Returns (status_code, parsed_json_or_none, debug_string).
    """
    host, port, https = _parse_url(cos_endpoint)
    encoded_key = urllib.parse.quote(object_key.lstrip("/"))
    path        = f"/{bucket}/{encoded_key}"
    target_url  = f"{'https' if https else 'http'}://{host}:{port}{path}"

    try:
        conn = (
            http.client.HTTPSConnection(host, port, timeout=10)
            if https
            else http.client.HTTPConnection(host, port, timeout=10)
        )
        conn.request("GET", path, headers={"Authorization": f"Bearer {iam_token}"})
        resp = conn.getresponse()
        data = resp.read()
        conn.close()

        debug = f"COS GET {target_url} → HTTP {resp.status}"

        if resp.status == 200:
            try:
                return resp.status, json.loads(data), debug
            except Exception:
                return resp.status, {"raw": data.decode("utf-8", errors="replace")}, debug

        err = data.decode("utf-8", errors="replace")[:300] if data else ""
        return resp.status, None, f"{debug}: {err}"
    except Exception as exc:
        return 500, None, f"COS GET {target_url} failed: {exc}"


def _poll_cos(
    task_id: str,
    iam_token: str,
    max_duration: float = POLL_TIMEOUT,
    interval: float = POLL_INTERVAL,
) -> dict | None:
    """
    Poll COS for {COS_PREFIX}/{task_id}.json until found or timeout elapsed.
    Returns the parsed JSON dict on success, None on timeout.
    """
    object_key = f"{COS_PREFIX}/{task_id}.json" if COS_PREFIX else f"{task_id}.json"
    deadline   = time.time() + max_duration

    while time.time() < deadline:
        status, result, _ = _get_cos_object(COS_ENDPOINT, COS_BUCKET, object_key, iam_token)
        if status == 200 and result is not None:
            return result
        time.sleep(interval)

    # One final check after the loop
    status, result, _ = _get_cos_object(COS_ENDPOINT, COS_BUCKET, object_key, iam_token)
    return result if (status == 200 and result is not None) else None


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _sanitize_id(val: str) -> str:
    """Allow only alphanumeric, dashes, and underscores in a task ID."""
    return re.sub(r"[^a-zA-Z0-9_\-]", "", val)


def _json_response(status_code: int, body: dict) -> dict:
    return {
        "headers":    {"Content-Type": "application/json"},
        "statusCode": status_code,
        "body":       body,
    }


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

def _handle_retrieve(task_id: str, iam_token: str) -> dict:
    """
    GET /result/{task_id}
    Look up the result in COS via IAM Bearer token and return it, or 404 if not ready.
    """
    object_key = f"{COS_PREFIX}/{task_id}.json" if COS_PREFIX else f"{task_id}.json"
    status, result, debug = _get_cos_object(COS_ENDPOINT, COS_BUCKET, object_key, iam_token)

    if status == 200 and result is not None:
        return _json_response(200, result)

    print(f"[fn] COS lookup for task {task_id}: {debug}")
    body: dict = {"task_id": task_id, "status": "pending_or_not_found"}
    if FUNCTION_URL:
        body["retrieve_url"] = f"{FUNCTION_URL}/result/{task_id}"
    return _json_response(404, body)


def _handle_submit(params: dict, iam_token: str) -> dict:
    """
    POST / or GET /
    Extract caller data from params, submit a fleet task, poll COS, and return.
    """
    # ── 1. Resolve configuration ───────────────────────────────────────────
    fleet_id   = str(params.get("fleet_id", FLEET_ID)).strip() or FLEET_ID
    project_id = CE_PROJECT_ID

    missing_config = [k for k, v in {
        "FLEET_ID":      fleet_id,
        "CE_PROJECT_ID": project_id,
        "CE_API_KEY":    CE_API_KEY,
    }.items() if not v]
    if missing_config:
        return _json_response(500, {"error": f"Missing required configuration: {', '.join(missing_config)}"})

    # ── 2. Resolve task_id and poll_timeout ────────────────────────────────
    raw_task_id = _sanitize_id(str(params.get("task_id", "")).strip())
    task_id     = raw_task_id or str(uuid.uuid4())

    try:
        poll_timeout_sec = float(params.get("poll_timeout", POLL_TIMEOUT))
    except (TypeError, ValueError):
        poll_timeout_sec = POLL_TIMEOUT

    # ── 3. Build the task payload (all non-reserved keys forwarded) ─────────
    task_data = {k: v for k, v in params.items() if k not in _RESERVED_KEYS}
    # Always include task_id so the worker knows its output filename
    task_data["task_id"] = task_id

    # ── 4. Submit task to fleet ────────────────────────────────────────────
    # task_data is serialised as a single JSON string passed as args[0].
    # The container reads it with: INPUT_JSON="$1"
    try:
        status, response = _add_fleet_task(
            CE_API_BASE_URL, project_id, fleet_id, iam_token, task_data, task_idx=task_id
        )
    except Exception as exc:
        return _json_response(502, {"error": f"Failed to call CE Fleet tasks API: {exc}"})

    if status not in (200, 201, 202):
        return _json_response(502, {
            "error":           "CE fleet tasks API returned an unexpected status",
            "upstream_status": status,
            "upstream_body":   response,
        })

    # ── 5. Poll COS for result (IAM Bearer) ────────────────────────────────
    if poll_timeout_sec > 0:
        result = _poll_cos(
            task_id      = task_id,
            iam_token    = iam_token,
            max_duration = poll_timeout_sec,
            interval     = POLL_INTERVAL,
        )
        if result is not None:
            return _json_response(200, {
                "task_id": task_id,
                "status":  "completed",
                "result":  result,
            })

    # ── 6. Polling timed out — return task_id for async retrieval ──────────
    body_202: dict = {
        "message":              "Task submitted and is being processed",
        "task_id":              task_id,
        "status":               "pending",
        "fleet_id":             fleet_id,
        "poll_timeout_seconds": poll_timeout_sec,
    }
    if FUNCTION_URL:
        body_202["retrieve_url"] = f"{FUNCTION_URL}/result/{task_id}"
    return _json_response(202, body_202)


# ---------------------------------------------------------------------------
# Function entry point
# ---------------------------------------------------------------------------

def main(params: dict) -> dict:
    """
    CE Function entry point.

    Routes:
      GET  /result/{task_id}  → fetch result from COS (IAM Bearer)
      POST /                  → submit task (IAM) + poll COS (IAM Bearer)
      GET  /                  → submit task (IAM) + poll COS (IAM Bearer)

    A single IAM token is obtained from CE_API_KEY at the start of each
    invocation and reused for both the CE Fleet API and COS requests.
    """
    if not CE_API_KEY:
        return _json_response(500, {"error": "Missing required configuration: CE_API_KEY"})

    # ── Obtain IAM token — used for both CE Fleet API and COS ─────────────
    try:
        iam_token = _get_iam_token(CE_API_KEY)
    except Exception as exc:
        return _json_response(502, {"error": f"Failed to obtain IAM token: {exc}"})

    # ── Unpack query string ────────────────────────────────────────────────
    if "__ce_query" in params and isinstance(params["__ce_query"], str) and params["__ce_query"]:
        try:
            parsed_query = urllib.parse.parse_qs(params["__ce_query"])
            for qk, qv in parsed_query.items():
                if qk not in params and qv:
                    params[qk] = qv[0]
        except Exception:
            pass

    # ── Route: GET /result/{task_id} ───────────────────────────────────────
    ce_path = str(params.get("__ce_path", "")).strip("/")
    if ce_path.startswith("result/"):
        raw_task_id = ce_path[len("result/"):]
        task_id     = _sanitize_id(raw_task_id.strip())
        if not task_id:
            return _json_response(400, {"error": "Invalid or missing task_id in path"})
        return _handle_retrieve(task_id, iam_token)

    # ── Route: POST / or GET / — submit a new task ─────────────────────────
    return _handle_submit(params, iam_token)
