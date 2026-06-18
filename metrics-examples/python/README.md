# Code Engine custom metrics examples for Python

This application helps debug connectivity issues for IBM Cloud Services and provides comprehensive monitoring through Prometheus metrics. It includes outbound HTTP call simulation, database connectivity testing, and compute-intensive workload simulation.

## Architecture

```
┌─────────────────────────────────────┐
│         Container                   │
│                                     │
│  ┌────────────────────────────┐     │
│  │  Main Application Server   │     │
│  │  Port: 8080                │     │
│  │  - /                       │     │
│  │  - /test-db                │     │
│  │  - /outbound/*             │     │
│  └────────────────────────────┘     │
│                                     │
│  ┌────────────────────────────┐     │
│  │  Metrics Server (Thread)   │     │
│  │  Port: 2112                │     │
│  │  - /metrics                │     │
│  └────────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

## Features

- **Outbound HTTP Calls**: Configurable endpoints that simulate delays and error responses to httpbin.org-compatible backends
- **Database Testing**: PostgreSQL connectivity verification with instrumented queries
- **Prometheus Metrics**: Comprehensive instrumentation for requests, outbound calls, database operations, and compute workloads
- **Load Testing**: Included shell script for generating realistic traffic patterns
- **Async/Await**: Non-blocking I/O for high performance
- **FastAPI**: Modern, fast web framework with automatic OpenAPI documentation

## Quick Start

### Deploy to IBM Cloud Code Engine

Deploy the application with recommended resource settings:

```bash
ibmcloud ce application create \
  --name metrics-example-app-python \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --port 8080
```

To configure environment variables during deployment:

```bash
ibmcloud ce application create \
  --name metrics-example-app-python \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --env HTTPBIN_BASE_URL=https://httpbin.org \
  --env METRICS_NAME_PREFIX=mymetrics_
```

Update an existing application:

```bash
ibmcloud ce application update \
  --name metrics-example-app-python \
  --env HTTPBIN_BASE_URL=https://custom-backend.example.com
```

## Configuration

### Environment Variables

- `PORT`: Application server port (default: 8080)
- `HTTPBIN_BASE_URL`: Backend URL for outbound calls (default: `https://httpbin.org`)
- `METRICS_NAME_PREFIX`: Prefix for all Prometheus metrics (default: `mymetrics_`)
- `DATABASES_FOR_POSTGRESQL_CONNECTION`: PostgreSQL connection credentials (JSON format)

### Service Bindings

For database connectivity, create a Code Engine service binding between your project and the IBM Cloud service. See [Working with service bindings](https://cloud.ibm.com/docs/codeengine?topic=codeengine-service-binding) for details.

## API Endpoints

- `GET /` - Health check
- `GET /test-db` - Test PostgreSQL connectivity
- `GET /outbound/delay` - Outbound call with random delay (0-2s) and 5% error rate
- `GET /outbound/get` - Simple outbound GET request
- `POST /outbound/post` - Outbound POST request
- `GET /outbound/status/{code}` - Request specific HTTP status code
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation (ReDoc)

All outbound endpoints include simulated compute-intensive data processing (0-3s duration, 40-80% CPU intensity).

## Metrics

The application exposes Prometheus metrics on a **separate metrics server** at `http://localhost:2112/metrics`. This separation provides better security and performance isolation. All metric names are prefixed with a configurable value set via the `METRICS_NAME_PREFIX` environment variable (default: `mymetrics_`).

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

**Python Runtime Metrics** (automatically collected by prometheus-client)
- Process CPU, memory, and other system metrics

## Development

### Project Structure

```
python/
├── app.py                  # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── Dockerfile              # Multi-stage Docker build
├── README.md               # This file
└── utils/
    ├── __init__.py         # Package initialization
    ├── metrics.py          # Prometheus metrics definitions
    ├── db.py               # PostgreSQL connection handling
    └── compute.py          # Compute simulation utilities
```

### Prerequisites

- Python 3.12 or later
- pip or poetry for package management
- Docker or Podman (for containerized builds)

### Run Locally

Pull and run with Docker:
```bash
docker pull icr.io/codeengine/metrics-example-app-python
docker run -p 8080:8080 -p 2112:2112 icr.io/codeengine/metrics-example-app-python
```

Or run from source:
```bash
python3 -m venv venv
source venv/bin/activate

python -m pip install -r requirements.txt
python app.py


# Test main application (in another terminal)
curl http://localhost:8080/

# Test metrics endpoint
curl http://localhost:2112/metrics

# Test graceful shutdown
# Send SIGTERM or press Ctrl+C
```

The application exposes:
- Main application: `http://localhost:8080`
- Metrics endpoint: `http://localhost:2112/metrics`
- Interactive API docs: `http://localhost:8080/docs`
- Alternative API docs: `http://localhost:8080/redoc`

### Building

```bash
# Build Docker image
podman build -t metrics-example-app-python .
```

## Performance Characteristics

- **Startup Time**: ~2-3 seconds
- **Memory Footprint**: ~100-150 MB
- **Image Size**: ~100-150 MB (distroless)
- **Concurrency**: Async/await based, handles many concurrent requests efficiently
- **CPU Efficiency**: Good performance with async I/O

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify the `DATABASES_FOR_POSTGRESQL_CONNECTION` environment variable is set correctly
2. Check that the service binding is properly configured
3. Ensure the certificate is valid and properly base64 encoded
4. Verify network connectivity to the PostgreSQL instance
5. Check asyncpg is properly installed: `pip install asyncpg`

### Import Errors

If you see import errors:

```bash
pip install -r requirements.txt --upgrade
```

### SSL/TLS Issues

For SSL certificate issues with PostgreSQL:

```bash
# Ensure you have the latest version of asyncpg
pip install --upgrade asyncpg
```

### Performance Issues

For better performance in production, you need to run both the main application and metrics server separately:

```bash
# Install gunicorn
pip install gunicorn

# Option 1: Run both servers using the default app.py (recommended for simplicity)
python3 app.py

# Option 2: For production with multiple workers, run servers separately:

# Terminal 1: Run main application with gunicorn (multiple workers)
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8080

# Terminal 2: Run metrics server separately (single worker is sufficient)
gunicorn app:metrics_app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:2112

# Option 3: Use a process manager like supervisord or systemd to manage both processes
```

**Note**: When using gunicorn with multiple workers for the main app, the metrics server should run as a separate process. The default `python3 app.py` approach handles both servers automatically in a single process, which is simpler for most use cases.

## FastAPI Features

This implementation uses FastAPI, which provides:

- **Automatic API Documentation**: Visit `/docs` for Swagger UI or `/redoc` for ReDoc
- **Async Support**: Native async/await for non-blocking I/O
- **High Performance**: One of the fastest Python frameworks available
- **Standards-based**: Based on OpenAPI and JSON Schema
