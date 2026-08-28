# Stage 1: build
FROM registry.access.redhat.com/ubi9/go-toolset:latest AS build
USER root
WORKDIR /src
COPY go.mod go.sum ./
COPY vendor ./vendor
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o /apiserver ./cmd/apiserver

# Stage 2: runtime
FROM registry.access.redhat.com/ubi9/ubi-minimal:latest
RUN microdnf install -y ca-certificates && microdnf clean all

# Create non-root user
RUN useradd -m -u 1001 appuser

COPY --from=build --chown=appuser:appuser /apiserver /apiserver

EXPOSE 8080

USER 1001
ENTRYPOINT ["/apiserver"]
