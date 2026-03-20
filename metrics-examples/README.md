# Code Engine custom metrics examples

The following samples demonstrate how to emit custom metrics in Code Engine jobs and apps across multiple programming languages.

## Available Languages

This repository provides identical metrics examples in four languages:

- **[Node.js](node/README.md)** - Express + prom-client
- **[Go](go/README.md)** - Gorilla Mux + prometheus/client_golang
- **[Java](java/README.md)** - Spring Boot + Micrometer
- **[Python](python/README.md)** - FastAPI + prometheus-client

All implementations expose the same metrics with identical names and provide the same API endpoints.

## Quick Start

### Build All Languages

```bash
# Build all language implementations
REGISTRY=<your-registry> ./build

# Or build a specific language
REGISTRY=<your-registry> LANGUAGE=go ./build
REGISTRY=<your-registry> LANGUAGE=java ./build
REGISTRY=<your-registry> LANGUAGE=python ./build
REGISTRY=<your-registry> LANGUAGE=node ./build
```

### Deploy to Code Engine

```bash
ibmcloud ce project select --name <your-project-name>

# Deploy a specific language
ibmcloud ce application create \
  --name metrics-example-app-go \
  --src ./go \
  --memory 0.5G \
  --cpu 0.25 \
  --port 8080

# Or use the run script (if available)
./run all
```

## Language Comparison

| Feature | Node.js | Go | Java | Python |
|---------|---------|-----|------|--------|
| **Framework** | Express | Gorilla Mux | Spring Boot | FastAPI |
| **Metrics Library** | prom-client | prometheus/client_golang | Micrometer | prometheus-client |
| **Startup Time** | ~1s | <1s | ~5-10s | ~2-3s |
| **Memory Footprint** | ~150-200 MB | ~20-30 MB | ~200-250 MB | ~100-150 MB |
| **Image Size** | ~150-200 MB | ~20-30 MB | ~200-250 MB | ~100-150 MB |
| **Concurrency Model** | Event loop | Goroutines | Threads | Async/await |
| **Best For** | Rapid development | Performance & efficiency | Enterprise apps | Modern APIs |

## Metrics

All applications expose Prometheus metrics at `/metrics` (port 2112). All metric names are prefixed with a configurable value set via the `METRICS_NAME_PREFIX` environment variable (default: `mymetrics_`).

Once custom metrics scraping is enabled (see asset [metrics-collector](../metrics-collector/README.md)), the following command can be used to import the "My custom Code Engine Metrics" dashboard into IBM Cloud Monitoring:

```bash
REGION=<region-of-your-IBM-Cloud-Monitoring-instance; e.g. eu-es>
MONITORING_INSTANCE_GUID=<guid-of-your-IBM-Cloud-Monitoring-instance>

# Load the custom metric dashboard configuration
CE_CUSTOM_METRICS_DASHBOARD=$(curl -sL https://raw.githubusercontent.com/IBM/CodeEngine/metric-collector-v2/metrics-examples/my-custom-code-engine-metrics-dashboard.json)

# Import the dashboard
curl -X POST https://$REGION.monitoring.cloud.ibm.com/api/v3/dashboards \
      -H "Authorization: $(ibmcloud iam oauth-tokens --output JSON|jq -r '.iam_token')" \
      -H "IBMInstanceID: $MONITORING_INSTANCE_GUID" \
      -H "Content-Type: application/json" \
      -d "{\"dashboard\": $CE_CUSTOM_METRICS_DASHBOARD}"
```

To customize the prefix, set the environment variable when starting the application:

```bash
# Node.js
METRICS_NAME_PREFIX=myapp_ node app.mjs

# Go
METRICS_NAME_PREFIX=myapp_ go run main.go

# Java
METRICS_NAME_PREFIX=myapp_ java -jar target/metrics-example-1.0.0.jar

# Python
METRICS_NAME_PREFIX=myapp_ python app.py
```

On Code Engine, set the environment variable in the application configuration:

```bash
ibmcloud ce app update "metrics-example-app-<language>" --env METRICS_NAME_PREFIX=myapp_
```

Following metrics are emitted by all language implementations:

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

**Language-Specific Runtime Metrics**
- **Node.js**: Event loop lag, heap usage, GC stats
- **Go**: Goroutines, memory stats, GC stats
- **Java**: JVM memory, threads, GC, class loading
- **Python**: Process stats, memory, CPU

## Load Testing

Generate test traffic using the included script:

```bash
# Test a specific language locally
LANGUAGE=node ./load-test.sh
LANGUAGE=go ./load-test.sh
LANGUAGE=java ./load-test.sh
LANGUAGE=python ./load-test.sh

# Test all languages sequentially
LANGUAGE=all ./load-test.sh

# Test against a remote deployment
TARGET_URL=https://your-app.example.com LANGUAGE=node ./load-test.sh

# Custom configuration
TARGET_URL=https://your-app.example.com LANGUAGE=go DURATION=120 CONCURRENT_REQUESTS=10 ./load-test.sh
```

Configuration options:
- `LANGUAGE`: Target language (node, go, java, python, or all) (default: node)
- `TARGET_URL`: Application endpoint (default: http://localhost:8080)
- `DURATION`: Test duration in seconds (default: 60)
- `CONCURRENT_REQUESTS`: Number of concurrent workers (default: 5)


### Deploying httpbin Backend

To deploy your own httpbin instance on IBM Cloud Code Engine instead of using the public service, use the following command with an image from a registry other than docker.io:

```bash
ibmcloud ce app create \
  --name httpbin \
  --src https://github.com/mark-sivill/httpbin \
  --memory 0.5G \
  --cpu 0.25 \
  --min-scale 0 \
  --max-scale 3 \
  --concurrency 100 \
  --port 9000
```

After deployment, get the application URL:

```bash
ibmcloud ce application get --name httpbin --output url
```

Then configure any metrics-example-app to use your httpbin instance:

```bash
# For any language
ibmcloud ce application update \
  --name metrics-example-app-<language> \
  --env HTTPBIN_BASE_URL=https://httpbin.your-project.us-south.codeengine.appdomain.cloud
```

## API Endpoints

All language implementations provide identical endpoints:

- `GET /` - Health check
- `GET /test-db` - Test PostgreSQL connectivity
- `GET /outbound/delay` - Outbound call with random delay (0-2s) and 5% error rate
- `GET /outbound/get` - Simple outbound GET request
- `POST /outbound/post` - Outbound POST request
- `GET /outbound/status/{code}` - Request specific HTTP status code

Metrics endpoint (port 2112):
- `GET /metrics` - Prometheus metrics (all languages)
- `GET /prometheus` - Alternative metrics endpoint (Java only)

## Project Structure

```
metrics-examples/
├── node/           # Node.js implementation
├── go/             # Go implementation
├── java/           # Java implementation
├── python/         # Python implementation
├── build           # Build script for all languages
├── load-test.sh    # Load testing script
└── README.md       # This file
```

## Contributing

When adding new features or metrics:

1. Implement the feature in all four languages
2. Use identical metric names across all implementations
3. Maintain consistent API endpoints
4. Update all language-specific README files
5. Test with the load-test.sh script

## License

See individual language directories for specific dependencies and licenses.
