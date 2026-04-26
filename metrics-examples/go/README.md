# Code Engine custom metrics examples for Go

This application helps debug connectivity issues for IBM Cloud Services and provides comprehensive monitoring through Prometheus metrics. It includes outbound HTTP call simulation, database connectivity testing, and compute-intensive workload simulation.

## Features

- **Outbound HTTP Calls**: Configurable endpoints that simulate delays and error responses to httpbin.org-compatible backends
- **Database Testing**: PostgreSQL connectivity verification with instrumented queries
- **Prometheus Metrics**: Comprehensive instrumentation for requests, outbound calls, database operations, and compute workloads
- **Load Testing**: Included shell script for generating realistic traffic patterns
- **Graceful Shutdown**: Proper cleanup of database connections and HTTP servers

## Quick Start

### Deploy to IBM Cloud Code Engine

Deploy the application with recommended resource settings:

```bash
ibmcloud ce application create \
  --name metrics-example-app-go \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --port 8080
```

To configure environment variables during deployment:

```bash
ibmcloud ce application create \
  --name metrics-example-app-go \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --env HTTPBIN_BASE_URL=https://httpbin.org \
  --env METRICS_NAME_PREFIX=mymetrics_ \
  --env METRICS_COLLECT_GO_METRICS_ENABLED=true
```

Update an existing application:

```bash
ibmcloud ce application update \
  --name metrics-example-app-go \
  --env HTTPBIN_BASE_URL=https://custom-backend.example.com \
  --env METRICS_COLLECT_GO_METRICS_ENABLED=true
```

### Run Locally

Pull and run with Docker:
```bash
docker pull icr.io/codeengine/metrics-example-app-go
docker run -p 8080:8080 -p 2112:2112 icr.io/codeengine/metrics-example-app-go
```

Or run from source:
```bash
go mod download
go run main.go
```

The application exposes two servers:
- Main application: `http://localhost:8080`
- Metrics endpoint: `http://localhost:2112/metrics`

## Configuration

### Environment Variables

- `PORT`: Application server port (default: 8080)
- `HTTPBIN_BASE_URL`: Backend URL for outbound calls (default: `https://httpbin.org`)
- `METRICS_NAME_PREFIX`: Prefix for all Prometheus metrics (default: `mymetrics_`)
- `METRICS_COLLECT_GO_METRICS_ENABLED`: Enable Go runtime and process metrics collection (default: false, set to `true` to enable)
- `DATABASES_FOR_POSTGRESQL_CONNECTION`: PostgreSQL connection credentials (JSON format)

### Service Bindings

For database connectivity, create a Code Engine service binding between your project and the IBM Cloud service. See [Working with service bindings](https://cloud.ibm.com/docs/codeengine?topic=codeengine-service-binding) for details.

## API Endpoints

- `GET /` - Health check
- `GET /test-db` - Test PostgreSQL connectivity
- `GET /outbound/delay` - Outbound call with random delay (0-2s) and 5% error rate
- `GET /outbound/get` - Simple outbound GET request
- `POST /outbound/post` - Outbound POST request
- `GET /outbound/status/:code` - Request specific HTTP status code

All outbound endpoints include simulated compute-intensive data processing (0-3s duration, 40-80% CPU intensity).

## Metrics

The application exposes Prometheus metrics at `/metrics` (port 2112). All metric names are prefixed with a configurable value set via the `METRICS_NAME_PREFIX` environment variable (default: `mymetrics_`).

**Request Metrics**
- `mymetrics_requests_total`: Total requests by method and path

**Outbound Call Metrics**
- `mymetrics_outbound_request_duration_seconds`: Histogram of outbound request durations
- `mymetrics_outbound_requests_total`: Total outbound requests by target, method, and status

**Database Metrics**
- `mymetrics_db_query_duration_seconds`: Histogram of query durations by operation and table
- `mymetrics_db_queries_total`: Total queries by operation, table, and status
- `mymetrics_db_connections_active`: Active database connections gauge

**Compute Metrics**
- `mymetrics_compute_duration_seconds`: Histogram of compute operation durations

**Go Runtime Metrics** (collected when `METRICS_COLLECT_GO_METRICS_ENABLED=true`)
- `go_goroutines`: Number of goroutines that currently exist
- `go_threads`: Number of OS threads created
- `go_info`: Information about the Go environment
- `go_memstats_*`: Detailed memory statistics (alloc, heap, stack, GC, etc.)
- `go_gc_duration_seconds`: GC invocation durations

**Process Metrics** (collected when `METRICS_COLLECT_GO_METRICS_ENABLED=true`)
- `process_cpu_seconds_total`: Total user and system CPU time spent in seconds
- `process_open_fds`: Number of open file descriptors
- `process_max_fds`: Maximum number of open file descriptors
- `process_virtual_memory_bytes`: Virtual memory size in bytes
- `process_resident_memory_bytes`: Resident memory size in bytes
- `process_start_time_seconds`: Start time of the process since unix epoch

## Development

### Prerequisites

- Go 1.22 or later
- Docker (for containerized builds)

### Building

```bash
# Build binary
go build -o metrics-example-app

# Build Docker image
docker build -t metrics-example-app-go .

# Run tests
go test ./...
```

### Project Structure

```
go/
├── main.go                 # Application entry point
├── go.mod                  # Go module definition
├── go.sum                  # Dependency checksums
├── Dockerfile              # Multi-stage Docker build
├── README.md               # This file
└── internal/
    ├── db/
    │   └── postgres.go     # PostgreSQL connection handling
    ├── handlers/
    │   └── handlers.go     # HTTP request handlers
    └── metrics/
        └── metrics.go      # Prometheus metrics definitions
```

## Performance Characteristics

- **Startup Time**: < 1 second
- **Memory Footprint**: ~20-30 MB
- **Image Size**: ~20-30 MB (distroless)
- **Concurrency**: Native goroutine-based, highly concurrent
- **CPU Efficiency**: Compiled binary, excellent performance

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify the `DATABASES_FOR_POSTGRESQL_CONNECTION` environment variable is set correctly
2. Check that the service binding is properly configured
3. Ensure the certificate is valid and properly base64 encoded
4. Verify network connectivity to the PostgreSQL instance

### Import Errors

If you see import errors during development:

```bash
go mod tidy
go mod download
```

### Build Issues

For build issues with CGO:

```bash
CGO_ENABLED=0 go build
