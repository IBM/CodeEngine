# Network Connectivity Test App

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
  --name network-test-app \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --port 8080
```

The `--concurrency 5` setting limits each instance to handle a maximum of 5 concurrent requests, ensuring stable performance given the compute-intensive operations.

To configure environment variables during deployment:

```bash
ibmcloud ce application create \
  --name network-test-app \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --concurrency 5 \
  --env HTTPBIN_BASE_URL=https://httpbin.org \
  --env METRICS_COLLECT_NODE_METRICS_ENABLED=true
```

Update an existing application:

```bash
ibmcloud ce application update \
  --name network-test-app \
  --env HTTPBIN_BASE_URL=https://custom-backend.example.com
```

### Run Locally

Pull and run with Docker:
```bash
docker pull icr.io/codeengine/network-test-app
docker run -p 8080:8080 -p 2112:2112 icr.io/codeengine/network-test-app
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

### Deploying httpbin Backend

To deploy your own httpbin instance on IBM Cloud Code Engine instead of using the public service, use the following command with an image from a registry other than docker.io:

```bash
ibmcloud ce application update \
  --name httpbin \
  --src https://github.com/mark-sivill/httpbin \
  --memory 0.5G \
  --cpu 0.25 \
  --min-scale 1 \
  --max-scale 3 \
  --concurrency 100 \
  --port 9000
```

After deployment, get the application URL:

```bash
ibmcloud ce application get --name httpbin --output url
```

Then configure the network-test-app to use your httpbin instance:

```bash
ibmcloud ce application update \
  --name network-test-app \
  --env HTTPBIN_BASE_URL=https://httpbin.your-project.us-south.codeengine.appdomain.cloud
```

The httpbin image from GitHub Container Registry (ghcr.io) is the official Postman-maintained implementation that works well in Code Engine environments.

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

The application exposes Prometheus metrics at `/metrics` (port 2112). All metric names are prefixed with a configurable value set via the `METRICS_NAME_PREFIX` environment variable (default: `mymetrics_node_`).

Enable custom metrics scraping:

```bash
ibmcloud ce project select --name your-project-name --kubecfg

kubectl patch kservice "network-test-app" --type=json -p='[
  {"op":"add","path":"/spec/template/metadata/annotations/codeengine.cloud.ibm.com~1userMetricsScrape","value":"true"},
  {"op":"add","path":"/spec/template/metadata/annotations/codeengine.cloud.ibm.com~1userMetricsPath","value":"/metrics"},
  {"op":"add","path":"/spec/template/metadata/annotations/codeengine.cloud.ibm.com~1userMetricsPort","value":"2112"}
]'
```

Once custom metrics scraping is enabled (see asset [metrics-collector](../metrics-collector/README.md)), the following command can be used to import the "My custom Code Engine Metrics" dashboard into IBM Cloud Monitoring:

```bash
# Load the custom metric dashboard configuration
CE_CUSTOM_METRICS_DASHBOARD=$(curl -sL https://raw.githubusercontent.com/IBM/CodeEngine/main/network-test-app/my-custom-code-engine-metrics-dashboard.json)

# Import the dashboard
curl -X POST https://$REGION.monitoring.cloud.ibm.com/api/v3/dashboards \
      -H "Authorization: $(ibmcloud iam oauth-tokens --output JSON|jq -r '.iam_token')" \
      -H "IBMInstanceID: $MONITORING_INSTANCE_GUID" \
      -H "Content-Type: application/json" \
      -d "{\"dashboard\": $CE_CUSTOM_METRICS_DASHBOARD}"
```

To customize the prefix, set the environment variable when starting the application:

```bash
METRICS_NAME_PREFIX=myapp_ node app.mjs
```

On Code Engine set the environment variable in the application configuration:

```bash
ibmcloud ce app update "network-test-app" --env METRICS_NAME_PREFIX=myapp_
```

Following metrics are emitted by the network-test-app:

**Request Metrics**
- `mymetrics_node_requests_total`: Total requests by method and path

**Outbound Call Metrics**
- `mymetrics_node_outbound_request_duration_seconds`: Histogram of outbound request durations
- `mymetrics_node_outbound_requests_total`: Total outbound requests by target, method, and status

**Database Metrics**
- `mymetrics_node_db_query_duration_seconds`: Histogram of query durations by operation and table
- `mymetrics_node_db_queries_total`: Total queries by operation, table, and status
- `mymetrics_node_db_connections_active`: Active database connections gauge

**Compute Metrics**
- `mymetrics_node_compute_duration_seconds`: Histogram of compute operation durations



## Load Testing

Generate test traffic using the included script:

```bash
# Local testing
./load-test.sh

# IBM Cloud Code Engine deployment
TARGET_URL=https://your-app.example.com ./load-test.sh

# Custom configuration
TARGET_URL=https://your-app.example.com DURATION=120 CONCURRENT_REQUESTS=10 ./load-test.sh
```

Configuration options:
- `TARGET_URL`: Application endpoint (default: http://localhost:8080)
- `DURATION`: Test duration in seconds (default: 60)
- `CONCURRENT_REQUESTS`: Number of concurrent workers (default: 5)

## Building

Build and push the container image:
```bash
./build
```

This builds the image and pushes it to `icr.io/codeengine/network-test-app`.
