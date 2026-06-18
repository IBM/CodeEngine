# # Code Engine custom metrics examples for Node.js

This application helps debug connectivity issues for IBM Cloud Services and provides comprehensive monitoring through Prometheus metrics. It includes outbound HTTP call simulation, database connectivity testing, and compute-intensive workload simulation.

## Features

- **Outbound HTTP Calls**: Configurable endpoints that simulate delays and error responses to httpbin.org-compatible backends
- **Database Testing**: PostgreSQL connectivity verification with instrumented queries
- **Prometheus Metrics**: Comprehensive instrumentation for requests, outbound calls, database operations, and compute workloads
- **Load Testing**: Included shell script for generating realistic traffic patterns

## Quick Start

### Deploy to IBM Cloud Code Engine

Deploy the application with recommended resource settings:

```bash
ibmcloud ce application create \
  --name metrics-example-app-node \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --port 8080
```

The `--concurrency 5` setting limits each instance to handle a maximum of 5 concurrent requests, ensuring stable performance given the compute-intensive operations.

To configure environment variables during deployment:

```bash
ibmcloud ce application create \
  --name metrics-example-app-node \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --env HTTPBIN_BASE_URL=https://httpbin.org \
  --env METRICS_COLLECT_NODE_METRICS_ENABLED=true
```

Update an existing application:

```bash
ibmcloud ce application update \
  --name metrics-example-app-node \
  --env HTTPBIN_BASE_URL=https://custom-backend.example.com
```

### Run Locally

Pull and run with Docker:
```bash
docker pull icr.io/codeengine/metrics-example-app-node
docker run -p 8080:8080 -p 2112:2112 icr.io/codeengine/metrics-example-app-node
```

Or run from source:
```bash
npm install
node app.mjs
```

The application exposes two servers:
- Main application: `http://localhost:8080`
- Metrics endpoint: `http://localhost:2112/metrics`

## Configuration

### Environment Variables

- `PORT`: Application server port (default: 8080)
- `HTTPBIN_BASE_URL`: Backend URL for outbound calls (default: `https://httpbin.org`)
- `METRICS_NAME_PREFIX`: Prefix for all Prometheus metrics (default: `mymetrics_`)
- `METRICS_COLLECT_NODE_METRICS_ENABLED`: Enable Node.js runtime metrics (set to "true")
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