#!/usr/bin/env python3
"""
Code Engine Function — generic clef classification task submitter and result fetcher

Features:
  1. Accepts direct plain text input ('input_data' or 'input_text', with fallback to
     'input_data_b64' if provided), instructions, and criteria.
  2. Generates a unique task_id (or accepts one from the caller), attaches it to the
     task spec, and submits the task to the Code Engine Fleet.
  3. Polls Cloud Object Storage (COS) for the resulting file:
       {COS_PREFIX}/{prefix}-{idx}.json (e.g. clef-result/result-<idx>.json)
  4. If the task completes within the polling duration (default: 60s), returns the
     full classification result (HTTP 200).
  5. If polling reaches the timeout, returns HTTP 202 with task_id and status: "pending".
  6. Supports direct result retrieval when called with { "task_id": "<id>" } or
     via HTTP query parameter / POST body without submit inputs.

Required environment variables (set on the CE function):
  FLEET_ID        — UUID or name of the target fleet
  CE_API_KEY      — IBM Cloud API key used for IAM token exchange (and COS access)
  COS_BUCKET      — Name of the COS bucket containing results (default: fleet-output-store)

Optional environment variables:
  CE_API_BASE_URL — CE API base URL (injected automatically by CE runtime,
                    e.g. https://api.private.eu-de.codeengine.cloud.ibm.com)
  CE_PROJECT_ID   — CE project UUID (injected automatically by CE runtime)
  COS_ENDPOINT    — COS S3 endpoint URL (default: s3.direct.eu-de.cloud-object-storage.appdomain.cloud
                    or s3.eu-de.cloud-object-storage.appdomain.cloud)
  COS_PREFIX      — Folder/prefix in the COS bucket (default: clef-result)
  FILE_PREFIX     — File name prefix for output JSON (default: result)
  POLL_TIMEOUT    — Maximum polling timeout in seconds (default: 60)
  POLL_INTERVAL   — Interval between poll attempts in seconds (default: 2)
"""

import base64
import http.client
import json
import os
import re
import time
import urllib.parse
import uuid


# ---------------------------------------------------------------------------
# Configuration — injected by CE runtime or set as function env vars
# ---------------------------------------------------------------------------
CE_API_BASE_URL = os.environ.get(
    "CE_API_BASE_URL",
    "https://api.private.eu-de.codeengine.cloud.ibm.com",
)
CE_PROJECT_ID = os.environ.get("CE_PROJECT_ID", "")
FLEET_ID = os.environ.get("FLEET_ID", "")
CE_API_KEY = os.environ.get("CE_API_KEY", "")

# Self-URL — used to give callers a ready-made retrieve_url in async responses
# Format: https://{CE_FUNCTION}.{CE_SUBDOMAIN}.{CE_DOMAIN}
# e.g.    https://clef-classify-fn.2d4z1pbknwdh.eu-de.codeengine.appdomain.cloud
_CE_FUNCTION = os.environ.get("CE_FUNCTION", "")
_CE_SUBDOMAIN = os.environ.get("CE_SUBDOMAIN", "")
_CE_DOMAIN = os.environ.get("CE_DOMAIN", "")
FUNCTION_URL = (
    f"https://{_CE_FUNCTION}.{_CE_SUBDOMAIN}.{_CE_DOMAIN}"
    if _CE_FUNCTION and _CE_SUBDOMAIN and _CE_DOMAIN
    else ""
)

# Cloud Object Storage (COS) configuration
COS_ENDPOINT = os.environ.get(
    "COS_ENDPOINT",
    "https://s3.direct.eu-de.cloud-object-storage.appdomain.cloud",
)
COS_BUCKET = os.environ.get("COS_BUCKET", "fleet-output-store")
COS_PREFIX = os.environ.get("COS_PREFIX", "clef-result").strip("/")
FILE_PREFIX = os.environ.get("FILE_PREFIX", "result").strip()
POLL_TIMEOUT = float(os.environ.get("POLL_TIMEOUT", "45.0"))
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "2.0"))

IAM_TOKEN_URL = "iam.cloud.ibm.com"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decode_b64(encoded: str) -> str:
    """Decode a base64-encoded string, handling standard and URL-safe variants
    as well as missing padding."""
    encoded = encoded.strip()
    padding = 4 - len(encoded) % 4
    if padding != 4:
        encoded += "=" * padding
    try:
        return base64.b64decode(encoded).decode("utf-8")
    except Exception:
        return base64.urlsafe_b64decode(encoded).decode("utf-8")


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
            "Accept": "application/json",
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
    url = url.removeprefix("https://").removeprefix("http://")
    host, _, port_str = url.partition(":")
    if "/" in host:
        host = host.split("/")[0]
    port = int(port_str) if port_str else (443 if https else 80)
    return host, port, https


def _add_fleet_task(api_base_url: str, project_id: str, fleet_id: str,
                    iam_token: str, args_list: list[str], task_idx: str | None = None) -> tuple:
    """
    POST /v2/projects/{project_id}/fleets/{fleet_id}/add_tasks?version=2025-07-10

    Calls the official Code Engine Fleet add_tasks API with FleetAddTasksPrototype.
    tasks_specification.json contains the list of tasks (JsonTaskData[]).
    """
    path = f"/v2/projects/{project_id}/fleets/{fleet_id}/add_tasks?version=2025-07-10"
    task_entry = {
        "args": [str(a) for a in args_list],
    }
    if task_idx:
        task_entry["idx"] = str(task_idx)

    payload = {
        "tasks_specification": {
            "json": [task_entry],
        }
    }

    body = json.dumps(payload)
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
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {iam_token}",
        },
    )
    resp = conn.getresponse()
    data = resp.read()
    conn.close()
    return resp.status, json.loads(data) if data else {}


def _get_cos_object(cos_endpoint: str, bucket: str, object_key: str, iam_token: str) -> tuple[int, dict | None, str]:
    """
    Retrieve an object from Cloud Object Storage via S3 REST API using IAM bearer token.
    Returns (status_code, parsed_json_dict_or_none, debug_info_str).
    """
    host, port, https = _parse_url(cos_endpoint)
    encoded_key = urllib.parse.quote(object_key.lstrip("/"))
    path = f"/{bucket}/{encoded_key}"

    headers = {
        "Authorization": f"Bearer {iam_token}",
        "Accept": "application/json",
    }

    target_url = f"{'https' if https else 'http'}://{host}:{port}{path}"

    try:
        conn = (
            http.client.HTTPSConnection(host, port, timeout=10)
            if https
            else http.client.HTTPConnection(host, port, timeout=10)
        )
        conn.request("GET", path, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()

        debug_msg = f"COS GET {target_url} returned HTTP {resp.status}"

        if resp.status == 200:
            try:
                return resp.status, json.loads(data), debug_msg
            except Exception:
                return resp.status, {"raw": data.decode("utf-8", errors="replace")}, debug_msg
        
        err_body = data.decode("utf-8", errors="replace")[:300] if data else ""
        return resp.status, None, f"{debug_msg}: {err_body}"
    except Exception as exc:
        return 500, None, f"COS GET {target_url} failed with exception: {exc}"


def _poll_cos_result(cos_endpoint: str, bucket: str, cos_prefix: str,
                     file_prefix: str, task_id: str, iam_token: str,
                     max_duration: float = POLL_TIMEOUT,
                     interval: float = POLL_INTERVAL) -> dict | None:
    """
    Poll COS for the result file {cos_prefix}/{file_prefix}-{task_id}.json until found or timeout reached.
    """
    filename = f"{file_prefix}-{task_id}.json" if file_prefix else f"{task_id}.json"
    object_key = f"{cos_prefix}/{filename}" if cos_prefix else filename
    start_time = time.time()

    while time.time() - start_time < max_duration:
        status, data, _ = _get_cos_object(cos_endpoint, bucket, object_key, iam_token)
        if status == 200 and data is not None:
            return data
        time.sleep(interval)

    # One final check before exiting
    status, data, _ = _get_cos_object(cos_endpoint, bucket, object_key, iam_token)
    if status == 200 and data is not None:
        return data

    return None


def _sanitize_id(val: str) -> str:
    """Ensure task_id only contains alphanumeric, dashes, and underscores."""
    return re.sub(r"[^a-zA-Z0-9_\-]", "", val)


def _sanitize_name(val: str) -> str:
    """Ensure question_name only contains alphanumeric, dashes, and underscores."""
    return re.sub(r"[^a-zA-Z0-9_\-]", "", val)


# ---------------------------------------------------------------------------
# Function entry point
# ---------------------------------------------------------------------------

def main(params: dict):
    """
    CE Function entry point.

    Supported Operations:
      1. Retrieve result by task_id:
         Input: { "task_id": "<id>" } (without classification instruction fields)
         Returns:
           200 — result found in COS
           404 — result not found yet (or invalid task_id)

      2. Submit and classify (with COS polling):
         Input:
           input_data / input_text / input_data_b64 — text to classify
           instructions                            — question instructions
           positive_criteria                       — TRUE criteria
           negative_criteria                       — FALSE criteria
           question_name                           — (optional) default: "result"
           threshold                               — (optional) default: 0.5
           task_id                                 — (optional) custom unique ID
           poll_timeout                            — (optional) max wait seconds (default: 60)
         Returns:
           200 — task completed, result returned directly
           202 — task submitted, still pending in fleet (poll timed out; returns task_id)
           400 — invalid or missing parameters
           502 — CE or IAM API failure
    """

    # ── A. Handle Query / Body Unpacking ──────────────────────────────────────
    # Code Engine unfolds query parameters into params and puts raw query string in '__ce_query'
    if "__ce_query" in params and isinstance(params["__ce_query"], str) and params["__ce_query"]:
        try:
            parsed_query = urllib.parse.parse_qs(params["__ce_query"])
            for qk, qv in parsed_query.items():
                if qk not in params and qv:
                    params[qk] = qv[0]
        except Exception:
            pass

    # ── B. Handle Result Retrieval by Task ID ─────────────────────────────────
    query_task_id = _sanitize_id(str(params.get("task_id", "")).strip())
    is_lookup_only = bool(query_task_id and not (
        params.get("instructions") or params.get("input_data") or params.get("input_text") or params.get("input_data_b64")
    ))

    if is_lookup_only:
        if not CE_API_KEY:
            return {
                "headers": {"Content-Type": "application/json"},
                "statusCode": 500,
                "body": {"error": "Missing required CE_API_KEY configuration"},
            }
        try:
            iam_token = _get_iam_token(CE_API_KEY)
        except Exception as exc:
            return {
                "headers": {"Content-Type": "application/json"},
                "statusCode": 502,
                "body": {"error": f"Failed to obtain IAM token: {exc}"},
            }

        cos_endpoint = str(params.get("cos_endpoint", COS_ENDPOINT)).strip() or COS_ENDPOINT
        cos_bucket = str(params.get("cos_bucket", COS_BUCKET)).strip() or COS_BUCKET
        cos_prefix = str(params.get("cos_prefix", COS_PREFIX)).strip().strip("/")
        file_prefix = str(params.get("file_prefix", params.get("prefix", FILE_PREFIX))).strip()
        filename = f"{file_prefix}-{query_task_id}.json" if file_prefix else f"{query_task_id}.json"
        object_key = f"{cos_prefix}/{filename}" if cos_prefix else filename

        status, result_data, debug_info = _get_cos_object(cos_endpoint, cos_bucket, object_key, iam_token)
        if status == 200 and result_data is not None:
            return {
                "headers": {"Content-Type": "application/json"},
                "statusCode": 200,
                "body": result_data,
            }
        else:
            # Log internal details server-side; return only task_id and status to caller
            print(f"COS lookup failed for task {query_task_id}: {debug_info}")
            body: dict = {
                "task_id": query_task_id,
                "status": "pending_or_not_found",
            }
            if FUNCTION_URL:
                body["retrieve_url"] = f"{FUNCTION_URL}?task_id={query_task_id}"
            return {
                "headers": {"Content-Type": "application/json"},
                "statusCode": 404,
                "body": body,
            }

    # ── C. Handle Task Submission & Polling ───────────────────────────────────

    # 1. Extract inputs (support plain text input_data / input_text, or base64 input_data_b64)
    input_text = ""
    if "input_data" in params and params["input_data"]:
        input_text = str(params["input_data"])
    elif "input_text" in params and params["input_text"]:
        input_text = str(params["input_text"])
    elif "input_data_b64" in params and params["input_data_b64"]:
        try:
            input_text = _decode_b64(str(params["input_data_b64"]))
        except Exception as exc:
            return {
                "headers": {"Content-Type": "application/json"},
                "statusCode": 400,
                "body": {"error": f"Failed to decode input_data_b64: {exc}"},
            }

    instructions = params.get("instructions", "").strip() if isinstance(params.get("instructions"), str) else ""
    positive_criteria = params.get("positive_criteria", "").strip() if isinstance(params.get("positive_criteria"), str) else ""
    negative_criteria = params.get("negative_criteria", "").strip() if isinstance(params.get("negative_criteria"), str) else ""
    question_name = (_sanitize_name(params.get("question_name", "result").strip()) if isinstance(params.get("question_name"), str) else "result") or "result"
    threshold = params.get("threshold", 0.5)
    fleet_id_override = params.get("fleet_id", "").strip() if isinstance(params.get("fleet_id"), str) else ""
    custom_task_id = _sanitize_id(str(params.get("task_id", "")).strip())
    task_id = custom_task_id or str(uuid.uuid4())

    poll_timeout_val = params.get("poll_timeout", POLL_TIMEOUT)
    try:
        poll_timeout_sec = float(poll_timeout_val)
    except (TypeError, ValueError):
        poll_timeout_sec = POLL_TIMEOUT

    missing_fields = []
    if not input_text:
        missing_fields.append("input_data (or input_text)")
    if not instructions:
        missing_fields.append("instructions")
    if not positive_criteria:
        missing_fields.append("positive_criteria")
    if not negative_criteria:
        missing_fields.append("negative_criteria")

    if missing_fields:
        return {
            "headers": {"Content-Type": "application/json"},
            "statusCode": 400,
            "body": {"error": f"Missing required fields: {', '.join(missing_fields)}"},
        }

    # 2. Validate threshold
    try:
        threshold = float(threshold)
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("threshold must be between 0.0 and 1.0")
    except (TypeError, ValueError) as exc:
        return {
            "headers": {"Content-Type": "application/json"},
            "statusCode": 400,
            "body": {"error": f"Invalid threshold: {exc}"},
        }

    # 3. Resolve configuration
    fleet_id = fleet_id_override or FLEET_ID
    project_id = CE_PROJECT_ID

    missing_config = [
        k for k, v in {
            "FLEET_ID": fleet_id,
            "CE_PROJECT_ID": project_id,
            "CE_API_KEY": CE_API_KEY,
        }.items() if not v
    ]
    if missing_config:
        return {
            "headers": {"Content-Type": "application/json"},
            "statusCode": 400,
            "body": {"error": f"Missing required configuration: {', '.join(missing_config)}"},
        }

    # 4. Obtain IAM token
    try:
        iam_token = _get_iam_token(CE_API_KEY)
    except Exception as exc:
        return {
            "headers": {"Content-Type": "application/json"},
            "statusCode": 502,
            "body": {"error": f"Failed to obtain IAM token: {exc}"},
        }

    # 5. Build task arguments as an array of strings (key-value sequence without task_id / idx)
    file_prefix = str(params.get("file_prefix", params.get("prefix", FILE_PREFIX))).strip()
    args_list = [
        "input_data", input_text,
        "instructions", instructions,
        "positive_criteria", positive_criteria,
        "negative_criteria", negative_criteria,
        "question_name", question_name,
        "threshold", str(threshold),
        "prefix", file_prefix,
    ]

    # 6. Submit task to Code Engine Fleet (passing args as array of strings and task_idx specified via idx)
    try:
        status, response = _add_fleet_task(
            CE_API_BASE_URL, project_id, fleet_id, iam_token, args_list, task_idx=task_id
        )
    except Exception as exc:
        return {
            "headers": {"Content-Type": "application/json"},
            "statusCode": 502,
            "body": {"error": f"Failed to call CE Fleet tasks API: {exc}"},
        }

    if status not in (200, 201, 202):
        return {
            "headers": {"Content-Type": "application/json"},
            "statusCode": 502,
            "body": {
                "error": "CE fleet tasks API returned an unexpected status",
                "upstream_status": status,
                "upstream_body": response,
            },
        }

    # 7. Poll COS for result if poll_timeout_sec > 0
    cos_endpoint = str(params.get("cos_endpoint", COS_ENDPOINT)).strip() or COS_ENDPOINT
    cos_bucket = str(params.get("cos_bucket", COS_BUCKET)).strip() or COS_BUCKET
    cos_prefix = str(params.get("cos_prefix", COS_PREFIX)).strip().strip("/")

    if poll_timeout_sec > 0:
        result_data = _poll_cos_result(
            cos_endpoint=cos_endpoint,
            bucket=cos_bucket,
            cos_prefix=cos_prefix,
            file_prefix=file_prefix,
            task_id=task_id,
            iam_token=iam_token,
            max_duration=poll_timeout_sec,
            interval=POLL_INTERVAL,
        )

        if result_data is not None:
            # Result available within timeout!
            return {
                "headers": {"Content-Type": "application/json"},
                "statusCode": 200,
                "body": {
                    "task_id": task_id,
                    "status": "completed",
                    "result": result_data,
                },
            }

    # 8. Timeout reached or async requested — return 202 with task_id
    if FUNCTION_URL:
        body_202["retrieve_url"] = f"{FUNCTION_URL}?task_id={task_id}"
    return {
        "headers": {"Content-Type": "application/json"},
        "statusCode": 202,
        "body": {
        "message": "Classification task submitted and in progress",
        "task_id": task_id,
        "status": "pending",
        "fleet_id": fleet_id,
        "question_name": question_name,
        "poll_timeout_seconds": poll_timeout_sec,
    },
    }
