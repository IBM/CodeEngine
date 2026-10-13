#!/usr/bin/env python3
"""
Fleet task entrypoint — generic clef classification via ollama /v1/systemone

Usage:
  entrypoint.py <task_spec_json>
  OR
  entrypoint.py input_data <val> instructions <val> positive_criteria <val> negative_criteria <val> [threshold <val>] [question_name <val>] [prefix <val>] [idx <val>]

Example:
  entrypoint.py input_data "Buy cheap meds!" instructions "Is this spam?" positive_criteria "It is spam." negative_criteria "It is not spam."

The ollama server is started by the fleet worker prehook and listens on
host.containers.internal:11434. The clef model is pulled and verified
before any task starts.

The classification result is written as JSON to:
  /data/results/<prefix>-<idx>.json
where /data/results is the persistent data store output bucket mounted by
the fleet (--mount-data-store /data/results=fleet-output-store:clef-result).

Exit codes:
  0 — task completed successfully, result file written
  1 — task failed (error printed to stderr)
"""

import http.client
import json
import os
import sys
import uuid


OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://host.containers.internal:11434")
MODEL = os.environ.get("MODEL", "clef")
RESULTS_DIR = os.environ.get("RESULTS_DIR", "/data/results")
FILE_PREFIX = os.environ.get("FILE_PREFIX", "result")
DEFAULT_THRESHOLD = float(os.environ.get("CLEF_THRESHOLD", "0.5"))


def _parse_host(url: str) -> tuple[str, int, bool]:
    """Return (host, port, use_https) from a bare host or http(s)://host[:port] URL."""
    https = url.startswith("https://")
    url = url.removeprefix("https://").removeprefix("http://")
    host, _, port_str = url.partition(":")
    port = int(port_str) if port_str else (443 if https else 80)
    return host, port, https


def _post(url_base: str, path: str, body: dict, timeout: int = 300) -> tuple[int, dict]:
    host, port, https = _parse_host(url_base)
    conn = (
        http.client.HTTPSConnection(host, port, timeout=timeout)
        if https
        else http.client.HTTPConnection(host, port, timeout=timeout)
    )
    conn.request("POST", path, json.dumps(body), {"Content-Type": "application/json"})
    resp = conn.getresponse()
    data = resp.read()
    conn.close()
    return resp.status, json.loads(data) if data else {}


def classify(task_spec: dict) -> dict:
    """
    Call clef /v1/systemone with the provided task spec.

    task_spec keys:
      input_data        — the text/content to judge (maps to clef "state")
      instructions      — noul question instructions
      positive_criteria — description of the TRUE outcome
      negative_criteria — description of the FALSE outcome
      question_name     — key name for the answer (default: "result")
      threshold         — probability threshold for True verdict (default: 0.5)
    """
    input_data = task_spec["input_data"]
    instructions = task_spec["instructions"]
    positive_criteria = task_spec["positive_criteria"]
    negative_criteria = task_spec["negative_criteria"]
    question_name = task_spec.get("question_name", "result")
    threshold = float(task_spec.get("threshold", DEFAULT_THRESHOLD))

    payload = {
        "model": MODEL,
        "state": input_data,
        "questions": {
            question_name: {
                "type": "noul",
                "instructions": instructions,
                # criteria describes each side of the noul decision (optional but recommended)
                "criteria": {
                    "true":  positive_criteria,
                    "false": negative_criteria,
                },
            }
        },
    }

    print(
        f"[task] Classifying with clef model '{MODEL}' "
        f"(question: '{question_name}', threshold: {threshold})...",
        file=sys.stderr,
    )

    status, data = _post(OLLAMA_HOST, "/v1/systemone", payload)

    if status not in (200, 201):
        raise RuntimeError(f"clef API returned HTTP {status}: {data}")

    answers = data.get("answers", {})
    # noul response schema per clef docs:
    #   {"type": "noul", "noul": <float 0-1>}
    # "noul" is the probability that the answer is TRUE.
    answer = answers.get(question_name, {})
    probability = answer.get("noul", 0.0)
    verdict = probability >= threshold

    return {
        "verdict":       verdict,
        "probability":   probability,
        "threshold":     threshold,
        "question_name": question_name,
        "instructions":  instructions,
        "model":         data.get("model", MODEL),
        "raw_clef":      data,
    }


def write_result(result: dict, task_id: str | None = None, file_prefix: str | None = None) -> str:
    """Write the result dict as JSON to RESULTS_DIR as <prefix>-<idx>.json and return the file path."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    # Prefer explicit task_id / idx (or CE_TASK_INDEX / CE_TASK_ID env vars), falling back to UUID
    effective_task_id = (
        task_id
        or os.environ.get("CE_TASK_INDEX")
        or os.environ.get("CE_TASK_ID")
        or str(uuid.uuid4())
    )
    effective_prefix = file_prefix or os.environ.get("FILE_PREFIX", FILE_PREFIX)
    filename = f"{effective_prefix}-{effective_task_id}.json" if effective_prefix else f"{effective_task_id}.json"
    out_path = os.path.join(RESULTS_DIR, filename)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    return out_path


def parse_args(argv: list[str]) -> dict:
    """
    Parse command-line arguments into a task_spec dictionary.
    Supports:
      1. Key-value string pairs in argv: ["input_data", "...", "instructions", "...", ...]
      2. Flag-value pairs: ["--input_data", "...", "--instructions", "...", ...]
      3. Fallback: single JSON string in argv[0]
    """
    if len(argv) == 1 and argv[0].strip().startswith("{") and argv[0].strip().endswith("}"):
        try:
            return json.loads(argv[0])
        except json.JSONDecodeError:
            pass

    task_spec = {}
    i = 0
    while i < len(argv):
        raw_key = argv[i]
        key = raw_key.lstrip("-")
        if i + 1 < len(argv):
            val = argv[i + 1]
            task_spec[key] = val
            i += 2
        else:
            task_spec[key] = ""
            i += 1
    return task_spec


def main() -> None:
    if len(sys.argv) < 2:
        print(
            json.dumps({"error": "Usage: entrypoint.py input_data <text> instructions <text> positive_criteria <text> negative_criteria <text>"}),
            file=sys.stderr,
        )
        sys.exit(1)

    raw_args = sys.argv[1:]
    try:
        task_spec = parse_args(raw_args)
    except Exception as exc:
        print(json.dumps({"error": f"Failed to parse arguments: {exc}"}), file=sys.stderr)
        sys.exit(1)

    required = ("input_data", "instructions", "positive_criteria", "negative_criteria")
    missing = [k for k in required if not task_spec.get(k)]
    if missing:
        print(
            json.dumps({"error": f"Missing required task_spec fields: {', '.join(missing)}"}),
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        result = classify(task_spec)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)

    task_id = task_spec.get("idx") or task_spec.get("task_id")
    file_prefix = task_spec.get("prefix") or task_spec.get("file_prefix")
    out_path = write_result(result, task_id=task_id, file_prefix=file_prefix)
    print(f"[task] Classification complete. Result written to {out_path}", file=sys.stderr)
    # Also echo the result to stdout so it appears in task logs
    print(json.dumps(result))


if __name__ == "__main__":
    main()
