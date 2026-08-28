# Remote Bob API Server

The apiserver is a **thin authenticated relay** for the Remote Bob v4
tunnel. It authenticates clients and agents, keeps an in-memory registry of
registered agents, and forwards WebSocket frames opaquely between a static
browser page and a job-agent tunnel daemon. It has **no session management,
no SQLite, no persistence, and no webserver**.

## Overview

The apiserver provides:

- REST auth: `POST /auth/login` (Basic) → 60s single-use WS token;
  `POST /auth/runs?agent=<id>` (Basic) → per-run agent token
- `GET /agents` (Basic) — registered agents + services
- Public health endpoints `GET /healthz`, `GET /readyz`
- Agent control WS `/ws/agent` (Bearer run token) — registration + control
  messages
- Browser WS `/ws/browser` (single-use WS token) — relay setup
- Agent relay WS `/ws/relay` (one-time relay token) — one per browser
- Opaque frame relay: text (0x1) and binary (0x2) frames forwarded
  byte-identical, FIN bit and opcode preserved
- CORS (configurable), request logging with credential redaction, panic
  recovery

There is **no persistence**: no SQLite, no database, no COS sync.
Configuration is loaded once from the environment (local mode) or mounted
secrets (Code Engine mode) at startup.

## Architecture

```
Browser (file:// single-session.html)
    │  WS /ws/browser?token=<wsToken>&agent=<agentId>&service=ttyd
    ▼
apiserver (auth + agent registry + opaque relay)
    │  control WS /ws/agent (Authorization: Bearer <runToken>)
    │  relay WS   /ws/relay?relayToken=<one-time>
    ▼
job-agent tunnel daemon (Go, in container)
    │  ttyd adapter → ttyd → tmux → Bob Shell
```

### Key components (`internal/api/`)

- `server.go` — routes, login/run-token/agents/health handlers, agent/browser
  WS handlers
- `agent_registry.go` — in-memory multi-agent registry (register, services,
  status, replace-on-redial)
- `relay.go`, `relay_pipe.go`, `relay_token.go` — per-browser relay
  lifecycle, opaque frame pipes, one-time relay tokens
- `run_token.go` — stateless HMAC-signed run tokens (bound to agentId, 24h
  TTL, survive restart)
- `token_store.go` — in-memory single-use WS token store (60s TTL)
- `basic_auth.go` — constant-time Basic auth against `GATEWAY_PASSWORD`
  (fails closed)
- `cors.go` — configurable allowed origins, preflight support
- `request_log.go` — request logging with credential redaction
- `panic_recovery.go` — panic recovery middleware

## Environment variables

### Local mode (`LOCAL_MODE=true`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GATEWAY_TOKEN` | Yes | Gateway token (fails startup if missing). |
| `GATEWAY_PASSWORD` | Yes* | Basic-auth password. *Fails closed: empty/unset → every login returns 503. |
| `ENCRYPTION_KEY` | No | Base64 of 32 bytes; also the run-token HMAC signing key. A dev default is used when unset. |
| `PORT` | `8080` | HTTP listen port. |
| `LOCAL_MODE` | `false` | Read config from env instead of mounted secrets. |
| `LOG_LEVEL` | `info` | Log level. |
| `ALLOWED_ORIGINS` | localhost + `null` | Comma-separated CORS allowed origins. |

### Code Engine mode (secrets mounted under `/secrets/`)

| Mount | Key | Description |
|---|---|---|
| `/secrets/gateway` | `gateway-token` | Gateway token. |
| `/secrets/gateway` | `gateway-password` | Basic-auth password. |
| `/secrets/gateway` | `encryption-key` | Base64 32-byte key (run-token signing key). |
| `/secrets/ibmcloud` | `api-key` | IBM Cloud API key. |

Configmap values (non-sensitive): `CE_PROJECT_ID`, `CE_REGION`,
`CE_JOB_NAME`, `LOG_LEVEL`, `LOCAL_MODE=false`.

See [documentation/ENVIRONMENT.md](../documentation/ENVIRONMENT.md) for the
full reference.

## API endpoints

### Health checks (public)

```http
GET /healthz
GET /readyz
```

Always 200 when the server is running: `{"status": "ok"}`.

### Login (WS token)

```http
POST /auth/login
Authorization: Basic <base64(admin:GATEWAY_PASSWORD)>
```

Returns `{"token": "<wsToken>", "expires_in": 60}`. The WS token is
single-use with a 60s TTL. Wrong/missing credentials → 401; unset password →
503.

### Run token

```http
POST /auth/runs?agent=<AGENT_ID>
Authorization: Basic <base64(admin:GATEWAY_PASSWORD)>
```

Returns `{"run_token": "<runToken>"}`. The run token is a stateless
HMAC-signed token bound to the agentId, 24h TTL, survives apiserver restart.

### Agent list

```http
GET /agents
Authorization: Basic <base64(admin:GATEWAY_PASSWORD)>
```

Returns `[{"agent_id": "...", "status": "ready", "services": ["ttyd"],
"registered_at": "..."}]`.

### WebSocket endpoints

```http
GET /ws/agent?agent=<AGENT_ID>
Authorization: Bearer <runToken>
```

Agent control connection. On connect the agent sends
`{"type":"register","services":[{"name":"ttyd","upstream":"ws://127.0.0.1:7080"}]}`.
Control messages: `register`, `relay-open`, `relay-close`, `relay-ready`
(JSON text frames). A second control connection with the same agentId
replaces the first.

```http
GET /ws/browser?token=<wsToken>&agent=<AGENT_ID>&service=ttyd
```

Browser connection. Requires a valid, unused, unexpired WS token and a
registered agent+service. On success the apiserver issues a one-time relay
token, sends `relay-open` over the agent control connection, waits (bounded,
10s) for the agent's relay dial, then pipes frames opaquely.

```http
GET /ws/relay?relayToken=<oneTime>
```

Agent relay connection, one per browser. Requires a valid one-time relay
token.

## Relay lifecycle

1. Browser connects to `/ws/browser` with a valid WS token + agent + service.
2. Apiserver issues a one-time relay token and sends `relay-open` over the
   agent control connection.
3. Agent dials `/ws/relay?relayToken=...` and opens the upstream to the
   local service (ttyd adapter performs the ttyd 1.7.7 handshake).
4. Frames are piped opaquely in both directions (opcode/FIN/payload
   preserved).
5. Browser disconnect → `relay-close` → agent closes the upstream. The
   agent control connection stays alive and the agent stays registered.

## Security

- Mutual auth: browser (Basic → single-use WS token) and agent (Bearer run
  token) are both authenticated; no anonymous path.
- Fails closed: missing/empty `GATEWAY_PASSWORD` → 503, never open access.
- Constant-time comparison (`crypto/subtle`) for passwords and token
  signatures.
- No credentials in URLs except the short-lived WS token and one-time relay
  token; the run token travels only in the `Authorization: Bearer` header.
- Request logging redacts the `Authorization` header value and credential
  query parameters.
- Run tokens are stateless (HMAC-signed with `ENCRYPTION_KEY`) and survive
  apiserver restart; WS and relay tokens are in-memory.

See [documentation/SECURITY.md](../documentation/SECURITY.md) for details.

## Local development

```bash
cd apiserver
LOCAL_MODE=true \
GATEWAY_TOKEN=$(openssl rand -hex 16) \
GATEWAY_PASSWORD=test-password \
ENCRYPTION_KEY=$(openssl rand -base64 32) \
PORT=3000 \
go run ./cmd/apiserver
```

The full local stack (apiserver + job-agent + Chrome) is normally started by
`run.sh`:

```bash
cd ..
./run.sh --mode=local --config=.env
```

## Tests

```bash
cd apiserver
go test ./...
go vet ./...
```

Unit tests cover auth (login, run tokens, WS token single-use/expiry,
rejection, constant-time), the agent registry (register/unregister/
multi-agent/replace), the relay lifecycle (browser connect → relay-open →
pipe → disconnect → cleanup), opaque frame preservation (text + binary
byte-identical), and CORS.

## License

Copyright IBM Corporation 2024-2026 — Apache License 2.0
