# Job Agent Deployment to IBM Code Engine

In the v4 flow, **run.sh is the deployment tool**: `./run.sh --mode=codeengine
--config=.env` provisions the Code Engine secrets and configmap, deploys the
apiserver app, ensures the job-agent job, and submits a job run with
`AGENT_ID` + `RUN_TOKEN`. This guide documents the job-agent job and how to
verify it.

## Prerequisites

- IBM Cloud CLI with the Code Engine plugin installed
- Code Engine project created and selected
- Bob Shell API key from [Bob web portal](https://bob.ibm.com)
- Apiserver deployed and accessible

## How the job is created

run.sh creates the job definition `remote-bob-job-agent` with a **source
build** from the monorepo root (`job-agent/Dockerfile`):

```bash
ibmcloud ce job create \
  --name remote-bob-job-agent \
  --build-source <monorepo-root> \
  --build-dockerfile job-agent/Dockerfile \
  --mode task \
  --cpu 1 \
  --memory 2G \
  --maxexecutiontime 3600 \
  --retrylimit 0 \
  --env GATEWAY_WSS=wss://<app-url>/ws \
  --env LOG_LEVEL=info \
  --mount-secret /secrets/gateway=remote-bob-gateway \
  --mount-secret /secrets/bobshell=remote-bob-bobshell
```

The job is **rebuilt only when it is missing or stale** (a v3-era
`GATEWAY_CALLBACK_URL` env marker, or a `GATEWAY_WSS` that does not match the
current app URL). A current job is reused with an env-var refresh.

## Per-run credentials

Each session gets its own credentials, provided by run.sh at job-run submit
time — **do not set them in the job definition**:

| Variable | Description |
|---|---|
| `AGENT_ID` | Agent identifier (replaces the v3 `SESSION_ID`), e.g. `agent-<16 hex>`. |
| `RUN_TOKEN` | Per-run token issued by `POST <app-url>/auth/runs?agent=<AGENT_ID>`. |

The run token authenticates the agent on `/ws/agent` via the
`Authorization: Bearer` header — never in a URL.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_ID` | Yes* | — | Agent identifier (provided by run.sh at submit time). |
| `RUN_TOKEN` | Yes* | — | Per-run token (provided by run.sh at submit time). |
| `GATEWAY_WSS` | Yes | — | Gateway WebSocket URL, e.g. `wss://<app-url>/ws`. |
| `BOBSHELL_API_KEY` | Yes | — | Bob Shell API key (mounted at `/secrets/bobshell/api-key`). |
| `TTYD_PORT` | No | `7080` | ttyd port (loopback only). |
| `HEALTH_PORT` | No | `7081` | Health check port (loopback only). |
| `WORKSPACE` | No | `/workspace` | Bob Shell working directory. |
| `BOB_MODE` | No | `interactive` | `interactive`, `plan`, or `auto`. |
| `IDLE_TIMEOUT_MS` | No | `300000` | Idle timeout (5 min default). |
| `GH_REPO` / `GH_PAT` / `GH_BRANCH` | No | — | Optional git integration. |

\* `AGENT_ID` and `RUN_TOKEN` are provided by run.sh when submitting the job
run. Do not set them in the job definition.

The v3-era `SESSION_ID`, `SESSION_TOKEN`, and `GATEWAY_TOKEN` variables are
removed in v4.

### Getting a Bob Shell API Key

1. Go to [Bob web portal](https://bob.ibm.com)
2. Log in with your IBM credentials
3. Navigate to Settings → API Keys
4. Click "Create API Key"
5. Select "Inference" scope
6. Copy the generated key
7. Use it as `BOBSHELL_API_KEY`

## Resource configuration

run.sh applies `DEFAULT_CPU` (default 1), `DEFAULT_MEMORY` (default 2G), and
`DEFAULT_TIMEOUT` (default 3600s) from `.env` to the job and each job run.
`--retrylimit 0` disables retries (recommended for interactive sessions).

## Testing

### Manual job run

Test the job manually before gateway integration:

```bash
ibmcloud ce jobrun submit \
  --name test-run \
  --job remote-bob-job-agent \
  --env AGENT_ID=test-agent \
  --env RUN_TOKEN=test-token
```

### View job run logs

```bash
# List recent job runs
ibmcloud ce jobrun list --job remote-bob-job-agent

# View logs for a specific run
ibmcloud ce jobrun logs --name <job-run-name>
```

### Gateway integration test

1. Deploy the apiserver with run.sh (`--mode=codeengine`)
2. Access the gateway URL in the browser
3. run.sh submits the job-agent run automatically
4. Verify the terminal connection works

## Monitoring

```bash
# List all job runs
ibmcloud ce jobrun list --job remote-bob-job-agent

# Get details of a specific run
ibmcloud ce jobrun get --name <jobrun-name>

# Stream logs
ibmcloud ce jobrun logs --name <jobrun-name> --follow

# Check job definition
ibmcloud ce job get --name remote-bob-job-agent
```

## Troubleshooting

### Job won't start

1. **Check job definition:** `ibmcloud ce job get --name remote-bob-job-agent`
2. **Check the source build:** `ibmcloud ce buildrun list`
3. **Check job run logs:** `ibmcloud ce jobrun logs --name <jobrun-name>`

### Connection issues

**Problem:** Can't connect to gateway
- Verify `GATEWAY_WSS` URL is correct (must match the current app URL)
- Check the gateway is running and accessible
- Verify the run token is valid (re-issue via `POST /auth/runs`)

**Problem:** WebSocket connection fails
- Ensure the gateway URL uses `wss://` (not `ws://`)
- Verify the gateway certificate is valid
- Check for firewall or proxy blocking WebSocket

### Bob Shell issues

**Problem:** Bob Shell won't start
- Verify `BOBSHELL_API_KEY` is valid
- Check the API key has "Inference" scope
- Review job logs for Bob Shell errors
- Ensure sufficient memory allocated

### Session issues

**Problem:** Agent not ready
- Verify the agent registered via `GET /agents` (Basic auth)
- Check `AGENT_ID` and `RUN_TOKEN` are passed correctly
- Ensure the run token is bound to the same `AGENT_ID`

## Security best practices

1. **Use IBM Cloud Secrets Manager** for sensitive values
2. **Rotate API keys regularly** — update `BOBSHELL_API_KEY` periodically
3. **Use least-privilege API keys** — only grant "Inference" scope to the
   Bob Shell API key
4. **Monitor job runs** — review logs for suspicious activity
5. **Secure the gateway connection** — always use `wss://` (WebSocket
   Secure) and verify the certificate

## Cost optimization

1. **Right-size resources** — start with 1 CPU / 2G memory and adjust
2. **Set appropriate timeouts** — don't set unnecessarily long timeouts
3. **Monitor job runs** — track and clean up idle sessions promptly
4. **Use regional endpoints** — deploy in the same region as the gateway

## Cleanup

run.sh deletes the job run on close. To delete the job definition:

```bash
ibmcloud ce job delete --name remote-bob-job-agent --force
```

**Warning:** This will prevent new sessions from starting. Existing job runs
will continue until completion.

## Next steps

After deploying the job-agent:

1. Configure run.sh with the CE credentials in `.env`
2. Test the end-to-end flow from the browser
3. Monitor job runs and resource usage
4. Adjust resources based on actual usage patterns

## Support

For issues or questions:
- Check the [main README](README.md) for configuration details
- Review Code Engine documentation: https://cloud.ibm.com/docs/codeengine
- Check Bob Shell documentation: https://bob.ibm.com/docs
- Contact the Remote Bob team
