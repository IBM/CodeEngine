# API Server Deployment to IBM Code Engine

In the v4 flow, **run.sh is the deployment tool**: `./run.sh --mode=codeengine
--config=.env` provisions the Code Engine secrets and configmap, deploys (or
updates) the apiserver application via a source build, ensures the job-agent
job, submits a job run, and tears everything down on close. This guide
documents what run.sh does and how to verify it.

## Prerequisites

- IBM Cloud CLI with the Code Engine plugin: `ibmcloud plugin install code-engine`
- `IBMCLOUD_API_KEY`, `CE_REGION`, `CE_PROJECT`, `RESOURCE_GROUP` in `.env`
- `jq`, `curl`, `google-chrome`

## What run.sh does (Code Engine mode)

1. Creates an isolated `IBMCLOUD_HOME` (`.ibmcloud-<pid>` in the repo root)
   so the login never touches your global ibmcloud state, installs the
   code-engine plugin there, and logs in.
2. Ensures the Code Engine project exists and is active. A soft-deleted
   project (`pending_reclamation`) is hard-deleted by ID and recreated.
3. Provisions three secrets and one configmap (idempotent get-then-create/
   update):
   - `remote-bob-gateway` → `/secrets/gateway` (`gateway-token`,
     `gateway-password`, `encryption-key`)
   - `remote-bob-ibmcloud` → `/secrets/ibmcloud` (`api-key`)
   - `remote-bob-bobshell` → `/secrets/bobshell` (`api-key`)
   - `remote-bob-config` configmap (`CE_PROJECT_ID`, `CE_REGION`,
     `CE_JOB_NAME`, `LOG_LEVEL`, `LOCAL_MODE=false`)
4. Deploys the apiserver application (`remote-bob-apiserver`) with a source
   build from `apiserver/` (create branch) or updates it (update branch),
   then waits for the app to be Ready.
5. Ensures the job-agent job (`remote-bob-job-agent`). The job is rebuilt
   only when it is missing or stale (v3-era `GATEWAY_CALLBACK_URL` env marker
   or a `GATEWAY_WSS` that does not match the current app URL); a current job
   is reused with an env-var refresh.
6. Issues a per-run token via `POST <app-url>/auth/runs?agent=<AGENT_ID>`
   and submits a job run with `AGENT_ID` + `RUN_TOKEN`.
7. Waits for the agent to report `ready` via `GET /agents`, then launches
   Chrome at the deployed app.
8. On Chrome close / Ctrl+C / SIGTERM: deletes the job run and deletes the
   app (or scales it to zero with `CE_CLEANUP_APP=stop`), removes the
   temporary `IBMCLOUD_HOME`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default: `8080`) |
| `LOCAL_MODE` | No | Must be `false` in Code Engine mode |
| `CE_PROJECT_ID` | Yes | Code Engine project ID (configmap) |
| `CE_REGION` | Yes | Code Engine region (configmap) |
| `CE_JOB_NAME` | Yes | Name of the job-agent job definition (configmap) |
| `LOG_LEVEL` | No | Log level (default: `info`) |

Sensitive values (`GATEWAY_TOKEN`, `GATEWAY_PASSWORD`, `ENCRYPTION_KEY`,
`IBMCLOUD_API_KEY`, `BOBSHELL_API_KEY`) are read from mounted secret files —
never set them as environment variables.

The v3-era `GATEWAY_CALLBACK_URL` variable is removed in v4: readiness comes
from registry registration, not a callback endpoint.

## Monitoring

```bash
# Stream logs
ibmcloud ce application logs --name remote-bob-apiserver --follow

# Check status
ibmcloud ce application get --name remote-bob-apiserver
```

## Cleanup

run.sh tears down the job run and the app on close. To clean up manually:

```bash
ibmcloud ce jobrun delete --name <job-run-name> --force
ibmcloud ce application delete --name remote-bob-apiserver --force
```
