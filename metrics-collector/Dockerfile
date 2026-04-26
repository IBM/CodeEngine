# Stage 1: Build Go binary
FROM quay.io/projectquay/golang:1.25 AS go-builder
WORKDIR /go/src/app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app main.go

# Stage 2: Download and extract Prometheus
FROM busybox:1.36-glibc AS prometheus-downloader
ARG PROMETHEUS_VERSION=3.10.0
ARG TARGETARCH=amd64

WORKDIR /tmp
RUN wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}.tar.gz && \
    tar xzf prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}.tar.gz && \
    mv prometheus-${PROMETHEUS_VERSION}.linux-${TARGETARCH}/prometheus /prometheus

# Stage 3: Get CA certificates and curl
FROM alpine:latest AS certs
RUN apk --no-cache add ca-certificates curl

# Stage 4: Runtime image
FROM busybox:1.36-glibc

# Copy curl binary and all its dependencies from alpine
# Use following command locally to determine the correct source paths:
# docker run --rm alpine:latest sh -c "apk add --no-cache curl > /dev/null 2>&1 && ldd /usr/bin/curl"
COPY --from=certs /usr/bin/curl /usr/bin/curl
COPY --from=certs /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1
COPY --from=certs /usr/lib/libcurl.so.4 /usr/lib/libcurl.so.4
COPY --from=certs /usr/lib/libz.so.1 /usr/lib/libz.so.1
COPY --from=certs /usr/lib/libnghttp2.so.14 /usr/lib/libnghttp2.so.14
COPY --from=certs /usr/lib/libnghttp3.so.9 /usr/lib/libnghttp3.so.9
COPY --from=certs /usr/lib/libbrotlidec.so.1 /usr/lib/libbrotlidec.so.1
COPY --from=certs /usr/lib/libbrotlicommon.so.1 /usr/lib/libbrotlicommon.so.1
COPY --from=certs /usr/lib/libssl.so.3 /usr/lib/libssl.so.3
COPY --from=certs /usr/lib/libcrypto.so.3 /usr/lib/libcrypto.so.3
COPY --from=certs /usr/lib/libcares.so.2 /usr/lib/libcares.so.2
COPY --from=certs /usr/lib/libidn2.so.0 /usr/lib/libidn2.so.0
COPY --from=certs /usr/lib/libpsl.so.5 /usr/lib/libpsl.so.5
COPY --from=certs /usr/lib/libzstd.so.1 /usr/lib/libzstd.so.1
COPY --from=certs /usr/lib/libunistring.so.5 /usr/lib/libunistring.so.5

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
    chmod 777 /tmp/agent-data && \
    chmod 777 /etc/secrets

# Set SSL certificate path environment variable
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

# Use non-root user
USER 1000:1000

ENTRYPOINT ["/start.sh"]
