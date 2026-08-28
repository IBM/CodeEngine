# Lessons Learned

Record what worked, what did not work, and how errors were resolved.
Add an entry every time something unexpected happens — do not wait until the end.

## Entry format
**Date**: YYYY-MM-DD
**Sub-Task**: <number and name>
**What happened**: <brief description>
**Root cause**: <why it happened>
**Fix / workaround**: <what resolved it>
**Impact on plan**: <none | updated sub-task N | added new sub-task>

---

## Go / toolchain

*(entries go here)*

## WebSocket / protocol

**Date**: 2026-06-29
**Sub-Task**: Local Testing & Debugging
**What happened**: Terminal connection established successfully but no output was displayed. Browser WebSocket disconnected after 5 seconds with "pong_timeout" errors. Gateway logs showed "forward_error: write tcp: i/o timeout" when trying to send terminal output to browser.
**Root cause**: The gateway's heartbeat function set a write deadline (`conn.SetWriteDeadline(time.Now().Add(10 * time.Second))`) when sending ping messages to detect dead connections. However, the deadline was never cleared after the ping was sent. This caused ALL subsequent writes on that WebSocket connection to fail with "i/o timeout" errors, including forwarding terminal output from the agent to the browser. The browser would then fail to respond to pings (because it never received them due to the write timeout), triggering a "pong_timeout" and connection closure after 5 seconds.
**Fix / workaround**: Added `conn.SetWriteDeadline(time.Time{})` immediately after sending the ping message in `internal/gateway/server.go` line 432. This clears the write deadline, allowing subsequent writes to succeed. The write deadline is only needed for the ping message itself to detect if the connection is dead during the write operation.
**Impact on plan**: No impact on plan. This was a bug in the implementation that was discovered during local testing. The fix is a one-line addition that properly manages WebSocket write deadlines according to Go's net package best practices.

*(entries go here)*

## PTY / Bob Shell

**Date**: 2026-06-26
**Sub-Task**: 7 — Docker Images
**What happened**: Docker builds fail with network connectivity errors. Gateway build initially failed with "dial tcp: lookup proxy.golang.org: i/o timeout" when running `go mod download`. Job-agent build fails with "getaddrinfo EAI_AGAIN registry.npmjs.org" when running `npm install -g @ibm/bob-shell`.
**Root cause**: Build environment has intermittent or blocked network access to external package repositories (proxy.golang.org for Go modules, registry.npmjs.org for npm packages). This appears to be a systemic issue in the build environment, not specific to this project.
**Fix / workaround**: For Go dependencies: ran `go mod vendor` locally to vendor all dependencies into the repo, then modified both Dockerfiles to `COPY vendor ./vendor` and use `go build -mod=vendor` flag. This successfully bypassed the need for network access during Go builds. Gateway image now builds successfully. For npm dependencies: no workaround implemented yet — would require either pre-downloading @ibm/bob-shell tarball and copying into image, or using a different base image with Bob Shell pre-installed, or fixing the network connectivity issue in the build environment.
**Impact on plan**: Gateway Dockerfile completed and builds successfully. Job-agent Dockerfile created but cannot be built until npm registry access is restored or an alternative approach is implemented. Sub-Task 7 is partially complete — gateway image works, job-agent image blocked by environment constraints.

**Date**: 2026-06-26
**Sub-Task**: 7 — Docker Images (continued)
**What happened**: Attempted three different approaches to install Bob Shell in job-agent Docker image:
1. `npm install -g @ibm/bob-shell` - failed with "getaddrinfo EAI_AGAIN registry.npmjs.org"
2. Official installation script `curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash` - failed because script is interactive and tries to access /dev/tty which doesn't exist in Docker build context. Script hung for 180s trying to prompt user, outputting "bash: line 177: /dev/tty: No such device or address" repeatedly.
3. Upgraded base image from node:20-slim to node:22-slim to meet Bob Shell's Node.js 22.15+ requirement, but installation script still hung.
**Root cause**: Bob Shell's official installation script (bobshell.sh) is designed for interactive terminal sessions and attempts to read from /dev/tty for user prompts. Docker build contexts don't have /dev/tty available, causing the script to hang indefinitely. Additionally, npm registry access remains blocked in the build environment.
**Fix / workaround**: Created a documented stub Dockerfile that:
- Uses node:22-slim base (meets Node.js version requirement)
- Installs system dependencies Bob Shell needs (curl, git, bash)
- Creates Bob Shell config directory structure with API-key auth pre-configured
- Documents three potential approaches for completing the installation once network access is restored or Bob Shell tarball is available locally
The Dockerfile is production-ready except for the actual Bob Shell installation step, which is clearly marked with TODO comments explaining the blocker and available options.
**Impact on plan**: Sub-Task 7 deliverables are complete to the extent possible given environment constraints. Gateway Dockerfile builds successfully. Job-agent Dockerfile is structurally complete and documented but cannot produce a working image until Bob Shell installation is resolved. This blocks Sub-Tasks 8 (CE deployment), 9 (local smoke test), and 10 (CI gate) which all depend on working Docker images.



*(entries go here)*

## Docker / images

*(entries go here)*

## Code Engine / IBM Cloud

*(entries go here)*