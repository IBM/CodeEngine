# Stage 1: Build Go binary
FROM quay.io/projectquay/golang:1.21 AS go-builder
WORKDIR /go/src/app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app main.go

# Stage 2: Download and extract Prometheus
FROM busybox:1.36-glibc AS prometheus-downloader
ARG PROMETHEUS_VERSION=3.9.1
ARG TARGETARCH=amd64

WORKDIR /tmp
RUN wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}.tar.gz && \
    tar xzf prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}.tar.gz && \
    mv prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}/prometheus /prometheus

# Stage 3: Get CA certificates
FROM alpine:latest AS certs
RUN apk --no-cache add ca-certificates

# Stage 4: Runtime image
FROM busybox:1.36-glibc

# Copy CA certificates for TLS verification
COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

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
    chmod 777 /tmp/agent-data

# Set SSL certificate path environment variable
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

# Use non-root user
USER 1000:1000

ENTRYPOINT ["/start.sh"]
