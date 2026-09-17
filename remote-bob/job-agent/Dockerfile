# Remote Bob — Go job-agent + tmux + ttyd architecture
#
# Agent-preset design
# ───────────────────
# The agent to run inside the container is selected at build time by the
# launcher script (./remote-bob --setup --agent-preset=<path>). The launcher
# writes the preset name into  job-agent/agents/selected-preset  and adjusts
# .ceignore so only the chosen preset directory is uploaded. This Dockerfile
# reads that file and runs the preset's install.sh at build time, then copies
# run.sh to /usr/local/bin/agent-run.sh for the Go job-agent to exec at runtime.
#
# Multi-stage build: Go job-agent compiled in a builder stage, copied into the
# runtime image.

# ── Stage 1: build the Go job-agent ──────────────────────────────────────────
# NOTE: UBI9 go-toolset is used for the build stage so the toolchain is from a
# Red Hat-maintained image. The runtime stage cannot use UBI9 because the
# job-agent runtime requires packages (Node.js 22, tmux, ttyd, locales) that
# are not available in the Red Hat UBI package ecosystem.
FROM registry.access.redhat.com/ubi9/go-toolset:latest AS go-builder
USER root

WORKDIR /src
COPY job-agent/go.mod job-agent/go.sum ./
RUN go mod download
COPY job-agent/cmd ./cmd
COPY job-agent/internal ./internal
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/job-agent ./cmd/job-agent

# ── Stage 2: runtime image ────────────────────────────────────────────────────
# debian:bookworm-slim is the minimal official Debian image; used here because
# Node.js 22 and tmux are not available in the UBI ecosystem. The large Debian
# community and package selection makes it straightforward for users to extend.
FROM debian:bookworm-slim

# Install system dependencies, Node.js 22, tmux, jq, and locales.
# Node.js 22 is installed here so it is available when install.sh runs
# (agents that need npm do not have to repeat this step).
# Note: Network debugging utilities like netcat-openbsd were removed to keep
# the image generic and minimal; if a specific agent requires it, install it in
# that agent's install.sh.
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    ca-certificates \
    gnupg \
    jq \
    tmux \
    locales \
    && sed -i 's/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen \
    && locale-gen \
    && mkdir -p /etc/apt/keyrings \
    # Node.js 22 apt repo
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set UTF-8 locale so agents / git / tmux emit Unicode instead of __ placeholders.
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

# ── Agent preset installation ─────────────────────────────────────────────────
# The launcher (./remote-bob --setup --agent-preset=<path>) writes the preset
# name into job-agent/agents/selected-preset before triggering the CE build.
# Only the selected preset directory is included in the build context
# (all others are excluded via the dynamic .ceignore the launcher generates).
COPY job-agent/agents/ /tmp/agents/
RUN preset="$(cat /tmp/agents/selected-preset)" \
    && echo "Installing agent preset: ${preset}" \
    && chmod +x /tmp/agents/${preset}/install.sh \
    && bash /tmp/agents/${preset}/install.sh \
    && chmod +x /tmp/agents/${preset}/run.sh \
    && cp /tmp/agents/${preset}/run.sh /usr/local/bin/agent-run.sh \
    && chmod +x /usr/local/bin/agent-run.sh \
    && rm -rf /tmp/agents

# Create workspace directory owned by jobagent.
RUN mkdir -p /workspace && chown jobagent:jobagent /workspace

# Create tmux config for the jobagent user.
RUN echo "set -g history-limit 50000" > /home/jobagent/.tmux.conf \
    && echo "set -g mouse on" >> /home/jobagent/.tmux.conf \
    && echo "set -g status-style bg=blue,fg=white" >> /home/jobagent/.tmux.conf \
    && echo "set -g default-terminal \"tmux-256color\"" >> /home/jobagent/.tmux.conf \
    && echo "set -ga terminal-overrides \",xterm-256color:Tc\"" >> /home/jobagent/.tmux.conf \
    && chown jobagent:jobagent /home/jobagent/.tmux.conf

# Set working directory.
WORKDIR /workspace

# Copy the Go job-agent binary.
COPY --from=go-builder /out/job-agent /usr/local/bin/job-agent
RUN chmod +x /usr/local/bin/job-agent

# Run as non-root.
USER 1001

# Expose ttyd port (7080) and health check port (7081).
EXPOSE 7080 7081

CMD ["/usr/local/bin/job-agent"]
