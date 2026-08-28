# Remote Bob — Go job-agent + tmux + ttyd architecture
# Multi-stage build: Go job-agent compiled in a builder stage, copied into the runtime image.

# ── Stage 1: build the Go job-agent ──────────────────────────────────────────
# NOTE: UBI9 go-toolset is used for the build stage so the toolchain is from a
# Red Hat-maintained image. The runtime stage cannot use UBI9 because the
# job-agent runtime requires packages (Node.js 22, tmux, ttyd, gh CLI, locales)
# that are not available in the Red Hat UBI package ecosystem.
FROM registry.access.redhat.com/ubi9/go-toolset:latest AS go-builder
USER root

WORKDIR /src
COPY job-agent/go.mod job-agent/go.sum ./
COPY job-agent/cmd ./cmd
COPY job-agent/internal ./internal
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=vendor -o /out/job-agent ./cmd/job-agent

# Prepare the Bob Shell tarball for the runtime stage. run.sh downloads the
# latest release from https://bob.ibm.com/releases?bob=shell and caches it in
# the repo root (never committed to git), then passes it via the
# BOBSHELL_TARBALL build arg. When the arg is empty (e.g. Code Engine source
# builds, which do not support build args), the latest release is downloaded
# inside the build from the official Bob Shell release source.
ARG BOBSHELL_TARBALL=
COPY ${BOBSHELL_TARBALL} /tmp/bobshell-src
RUN if [ -f /tmp/bobshell-src ]; then \
        cp /tmp/bobshell-src /tmp/bobshell-package; \
    else \
        curl -fsSL https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell2-version.txt -o /tmp/bobshell-version.txt \
        && BOBSHELL_VERSION="$(tr -d '[:space:]' < /tmp/bobshell-version.txt)" \
        && curl -fsSL "https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-${BOBSHELL_VERSION}.tgz" -o /tmp/bobshell-package; \
    fi \
    && rm -rf /tmp/bobshell-src /tmp/bobshell-version.txt

# ── Stage 2: runtime image ────────────────────────────────────────────────────
# debian:bookworm-slim is the minimal official Debian image; used here because
# Node.js 22, tmux, ttyd, and gh CLI are not available in the UBI ecosystem.
FROM debian:bookworm-slim

# Install system dependencies, Node.js 22, gh CLI, tmux, jq, and locales
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    ca-certificates \
    gnupg \
    jq \
    tmux \
    netcat-openbsd \
    locales \
    && sed -i 's/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen \
    && locale-gen \
    && mkdir -p /etc/apt/keyrings \
    # Node.js 22 apt repo
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    # GitHub CLI apt repo
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /etc/apt/keyrings/githubcli.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y nodejs gh \
    && rm -rf /var/lib/apt/lists/*

# Set UTF-8 locale so Bob Shell / git / tmux emit Unicode instead of __ placeholders
ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LANGUAGE=en_US:en

# Install ttyd (terminal over WebSocket) with SHA-256 checksum verification.
# SHA-256 checksums sourced from the official ttyd 1.7.7 GitHub release.
# Only x86_64 (amd64) and aarch64 (arm64) are supported in this build.
RUN curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.$(uname -m)" -o /usr/local/bin/ttyd \
    && case "$(uname -m)" in \
         x86_64)  echo "8a217c968aba172e0dbf3f34447218dc015bc4d5e59bf51db2f2cd12b7be4f55  /usr/local/bin/ttyd" | sha256sum -c - ;; \
         aarch64) echo "b38acadd89d1d396a0f5649aa52c539edbad07f4bc7348b27b4f4b7219dd4165  /usr/local/bin/ttyd" | sha256sum -c - ;; \
         *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;; \
       esac \
    && chmod +x /usr/local/bin/ttyd

# Create a non-root user for running the job agent process.
RUN useradd -m -u 1001 -s /bin/bash jobagent

# Install Bob Shell (API key supplied at runtime via BOBSHELL_API_KEY env var).
COPY --from=go-builder /tmp/bobshell-package /tmp/bobshell-package
RUN mv /tmp/bobshell-package /tmp/bobshell.tgz \
    && npm install -g /tmp/bobshell.tgz \
    && rm /tmp/bobshell.tgz \
    && bob --version

# Pre-configure Bob Shell for the jobagent user
RUN mkdir -p /home/jobagent/.bob/settings \
    && jq -n '{"autoAcceptLicense":true,"autoAcceptIbmLicense":true,"telemetry":{"enabled":false},"autoTrustWorkspace":true,"approvalMode":"auto_approve","ibm":{"isNotFirstTime":true,"licenseConsent":true},"prev_version":"2.0.0","bobShell":{"autoUpdate":false,"lastRunVersion":"2.0.0"}}' \
        > /home/jobagent/.bob/settings/settings.json \
    && jq -n '{"version":1,"folders":{"/workspace":"TRUST_FOLDER"}}' > /home/jobagent/.bob/trustedFolders.json \
    && chown -R jobagent:jobagent /home/jobagent/.bob

# Install the custom Bob modes (e.g. autonomous-loop-planner for BOB_MODE=plan)
COPY job-agent/bob-config/settings/custom_modes.yaml /home/jobagent/.bob/settings/custom_modes.yaml
RUN chown jobagent:jobagent /home/jobagent/.bob/settings/custom_modes.yaml

# Create workspace directory owned by jobagent
RUN mkdir -p /workspace && chown jobagent:jobagent /workspace

# Create tmux config for the jobagent user
RUN echo "set -g history-limit 50000" > /home/jobagent/.tmux.conf \
    && echo "set -g mouse on" >> /home/jobagent/.tmux.conf \
    && echo "set -g status-style bg=blue,fg=white" >> /home/jobagent/.tmux.conf \
    && echo "set -g default-terminal \"tmux-256color\"" >> /home/jobagent/.tmux.conf \
    && echo "set -ga terminal-overrides \",xterm-256color:Tc\"" >> /home/jobagent/.tmux.conf \
    && chown jobagent:jobagent /home/jobagent/.tmux.conf

# Set working directory
WORKDIR /workspace

# Copy the Go job-agent binary
COPY --from=go-builder /out/job-agent /usr/local/bin/job-agent
RUN chmod +x /usr/local/bin/job-agent

# Run as non-root
USER 1001

# Expose ttyd port (7080) and health check port (7081)
EXPOSE 7080 7081

CMD ["/usr/local/bin/job-agent"]
