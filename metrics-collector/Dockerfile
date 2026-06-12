# Stage 1: Build Go binary
FROM quay.io/projectquay/golang:1.25 AS go-builder
WORKDIR /go/src/app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app main.go

# Stage 2: Download and extract Prometheus
FROM registry.access.redhat.com/ubi9/ubi:latest AS prometheus-downloader
ARG PROMETHEUS_VERSION=3.12.0
ARG TARGETARCH=amd64

WORKDIR /tmp
RUN curl -L -o prometheus.tar.gz "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}.tar.gz" && \
    tar xzf prometheus.tar.gz && \
    mv "prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}/prometheus" /prometheus

# Stage 3: Runtime image
FROM registry.access.redhat.com/ubi9/ubi-minimal:latest

# Install CA certificates (curl-minimal is already included in ubi-minimal)
RUN microdnf install -y ca-certificates && \
    microdnf clean all

# Copy Go binary
COPY --from=go-builder /go/src/app/app /app

# Copy Prometheus binary
COPY --from=prometheus-downloader /prometheus /bin/prometheus

# Copy configuration and scripts
COPY prometheus.yml.template /etc/prometheus/prometheus.yml.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Create necessary directories with proper permissions
RUN mkdir -p /tmp/agent-data && \
    mkdir -p /etc/secrets && \
    chmod 777 /tmp/agent-data && \
    chmod 777 /etc/secrets

# Use non-root user
USER 1000:1000

ENTRYPOINT ["/start.sh"]

# Made with Bob
