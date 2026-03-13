# Code Engine custom metrics examples

The following samples demonstrate how to emit custom metrics in Code Engine jobs and apps.

Use the following command to build and deploy all examples to the Code Engine project of your choice.
```
ibmcloud ce project select --name <your-project-name>

./run all
```

## Metrics

The application provided in this example expose Prometheus metrics at `/metrics` (port 2112). All metric names are prefixed with a configurable value set via the `METRICS_NAME_PREFIX` environment variable (default: `mymetrics_`).


Once custom metrics scraping is enabled (see asset [metrics-collector](../metrics-collector/README.md)), the following command can be used to import the "My custom Code Engine Metrics" dashboard into IBM Cloud Monitoring:

```bash
# Load the custom metric dashboard configuration
CE_CUSTOM_METRICS_DASHBOARD=$(curl -sL https://raw.githubusercontent.com/IBM/CodeEngine/main/metrics-examples/my-custom-code-engine-metrics-dashboard.json)

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
ibmcloud ce app update "metrics-example-app-node" --env METRICS_NAME_PREFIX=myapp_
```

Following metrics are emitted by the metrics-example-app-node:

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


## Put some load on your app

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
