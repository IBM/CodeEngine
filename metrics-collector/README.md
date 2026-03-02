# IBM Cloud Code Engine - Metrics Collector

Code Engine job that demonstrates how to collect resource metrics (CPU, memory and disk usage) of running Code Engine apps, jobs, and builds.

Those metrics can either be render 

in **IBM Cloud Monitoring** (see [instructions](#Send-metrics-to-IBM-Cloud-Monitoring))

![](./images/monitoring-dashboard-ce-component-resources.png)

or in **IBM Cloud Logs** (see [instructions](#ibm-cloud-logs-setup))

![Dashboard overview](./images/icl-dashboard-overview.png)

## Send metrics to IBM Cloud Monitoring

### Setup Instructions

**Step 1:** You need an IBM Cloud Monitoring instance
```bash
REGION=<yourMonitoringInstanceRegion>
MONITORING_INSTANCE_NAME="<yourMonitoringInstanceName>"
MONITORING_INSTANCE_GUID=$(ibmcloud resource service-instance "$MONITORING_INSTANCE_NAME" -o JSON|jq -r '.[0].guid')
echo "MONITORING_INSTANCE_GUID: '$MONITORING_INSTANCE_GUID'"
```
**Step 2:** The collector must run in a Code Engine project
```bash
# Create new Code Engine project 
ibmcloud ce project create --name <yourCodeEngineProjectName>

# Select an existing Code Engine project
ibmcloud ce project select --name <yourProjectName>
```

**Step 3:** Create a secret with your IBM Cloud Monitoring API token
```bash
# Obtain the Monitoring API token of the IBM Cloud Monitoring instance
# using the IAM access token of the current IBM CLI Session
MONITORING_INSTANCE_MONITORING_API_KEY=$(curl --silent -X GET https://$REGION.monitoring.cloud.ibm.com/api/token -H "Authorization: $(ibmcloud iam oauth-tokens --output JSON|jq -r '.iam_token')" -H "IBMInstanceID: $MONITORING_INSTANCE_GUID" -H "content-type: application/json"|jq -r '.token.key')

# Create a Code Engine secret that stores the Monitoring API Key
ibmcloud ce secret create \
    --name monitoring-apikey \
    --from-literal monitoring-apikey=$MONITORING_INSTANCE_MONITORING_API_KEY
```

**Step 4:** Create your metrics-collector job with the required configuration
```bash
ibmcloud ce job create \
    --name metrics-collector \
    --src "." \
    --mode daemon \
    --cpu 0.25 \
    --memory 0.5G \
    --build-size xlarge \
    --env INTERVAL=30 \
    --env METRICS_ENABLED=true \
    --env METRICS_REMOTE_WRITE_FQDN=ingest.prws.private.${REGION}.monitoring.cloud.ibm.com \
    --env CE_PROJECT_NAME="$(ibmcloud ce proj current --output json|jq -r '.name')" \
    --mount-secret /etc/secrets=monitoring-apikey
```

**Step 5:** Submit a daemon job run**
```bash
ibmcloud ce jobrun submit \
    --job metrics-collector
```

**Step 6:** Import the "IBM Cloud Code Engine - Component Resource Overview" dashboard
```bash
# Load the most recent dashboard configuration
CE_MONITORING_DASHBOARD=$(curl -sL https://raw.githubusercontent.com/IBM/CodeEngine/main/metrics-collector/setup/ibm-cloud-monitoring/code-engine-component-resource-overview.json)

# Import the dashboard
curl -X POST https://$REGION.monitoring.cloud.ibm.com/api/v3/dashboards \
      -H "Authorization: $(ibmcloud iam oauth-tokens --output JSON|jq -r '.iam_token')" \
      -H "IBMInstanceID: $MONITORING_INSTANCE_GUID" \
      -H "Content-Type: application/json" \
      -d "{\"dashboard\": $CE_MONITORING_DASHBOARD}"

```

**Note:** A more elaborated approach to manage custom Cloud Monitoring dashboards can be found [here](setup/ibm-cloud-monitoring/README.md)

### How It Works

1. The metrics collector exposes Prometheus metrics on `localhost:9100/metrics`
2. The embedded Prometheus agent scrapes these metrics every 30 seconds
3. The agent also discovers and scrapes pods with the `codeengine.cloud.ibm.com/userMetricsScrape: 'true'` annotation
4. All metrics are forwarded to IBM Cloud Monitoring via remote write
5. If either the collector or Prometheus agent crashes, the container exits with a non-zero code to trigger a restart

### Required Environment Variables for Prometheus Integration

- **`METRICS_ENABLED=true`**: Enables the Prometheus agent
- **`METRICS_REMOTE_WRITE_FQDN`**: IBM Cloud Monitoring ingestion endpoint FQDN (required when `METRICS_ENABLED=true`)
- **Secret Mount**: `/etc/secrets/monitoring-apikey` must contain your IBM Cloud Monitoring API key

### Troubleshooting

If the container fails to start with `METRICS_ENABLED=true`, check the logs for:
- Missing `/etc/secrets/monitoring-apikey` file
- Missing or wrong `METRICS_REMOTE_WRITE_FQDN` environment variable

### Configuration

Per default the metrics collector collects memory and CPU statistics, like `usage`, `current` and `configured`.

#### Environment Variables

- **`INTERVAL`** (default: `30`): Collection interval in seconds (minimum 30 seconds). Controls how frequently metrics are collected in daemon mode.
- **`COLLECT_DISKUSAGE`** (default: `false`): Set to `true` to collect disk space usage. Note: The metrics collector calculates the overall file size stored in the pod's filesystem, which includes files from the container image, ephemeral storage, and mounted COS buckets. This metric cannot be used to calculate ephemeral storage usage alone.
- **`METRICS_ENABLED`** (default: `false`): Set to `true` to enable the HTTP metrics server. When disabled, the collector still runs and logs metrics to stdout but does not expose the HTTP endpoint.
- **`METRICS_PORT`** (default: `9100`): HTTP server port for the Prometheus metrics endpoint. Only used when `METRICS_ENABLED=true` in daemon mode.

### Prometheus Metrics Endpoint

When running in **daemon mode** with **`METRICS_ENABLED=true`**, the metrics collector exposes an HTTP server on port 9100 (configurable via `METRICS_PORT`) with a `/metrics` endpoint that provides Prometheus-compatible metrics.

**Note**: The HTTP server is only started when `METRICS_ENABLED=true`. When disabled, the collector continues to run and log metrics to stdout in JSON format, but does not expose the HTTP endpoint.

#### Accessing the Metrics Endpoint

The metrics endpoint is available at `http://<pod-ip>:9100/metrics` and can be scraped by Prometheus or accessed directly.

#### Exposed Metrics

The following Prometheus metrics are exposed as gauges:

Container Metrics:
- **`ibm_codeengine_instance_cpu_usage_millicores`**: Current CPU usage in millicores
- **`ibm_codeengine_instance_cpu_limit_millicores`**: Configured CPU limit in millicores
- **`ibm_codeengine_instance_memory_usage_bytes`**: Current memory usage in bytes
- **`ibm_codeengine_instance_memory_limit_bytes`**: Configured memory limit in bytes
- **`ibm_codeengine_instance_ephemeral_storage_usage_bytes`**: Current ephemeral storage usage in bytes (if `COLLECT_DISKUSAGE=true`)

The following 3 metrics are used to monitor the collector itself:
- **`ibm_codeengine_collector_collection_duration_seconds`**: Time taken to collect metrics in seconds (if `METRICS_INTERNAL_STATS=true`)
- **`ibm_codeengine_collector_last_collection_timestamp_seconds`**: Unix timestamp of last successful collection (if `METRICS_INTERNAL_STATS=true`)
- **`ibm_codeengine_collector_collection_errors_total`**: Total number of collection errors (counter) (if `METRICS_INTERNAL_STATS=true`)

#### Metric Labels

All container metrics include the following labels:
- `ibm_codeengine_instance_name`: Name of the pod instance
- `ibm_codeengine_component_type`: Type of component (`app`, `job`, or `build`)
- `ibm_codeengine_component_name`: Name of the Code Engine component

#### Example Metrics Output

```prometheus
# HELP ibm_codeengine_instance_cpu_usage_millicores Current CPU usage in millicores
# TYPE ibm_codeengine_instance_cpu_usage_millicores gauge
ibm_codeengine_instance_cpu_usage_millicores{ibm_codeengine_instance_name="myapp-00001-deployment-abc123",ibm_codeengine_component_type="app",ibm_codeengine_component_name="myapp"} 250

# HELP ibm_codeengine_instance_memory_usage_bytes Current memory usage in bytes
# TYPE ibm_codeengine_instance_memory_usage_bytes gauge
ibm_codeengine_instance_memory_usage_bytes{ibm_codeengine_instance_name="myapp-00001-deployment-abc123",ibm_codeengine_component_type="app",ibm_codeengine_component_name="myapp"} 134217728
```

## IBM Cloud Logs setup

Once your IBM Cloud Code Engine project has detected a corresponding IBM Cloud Logs instance, which is configured to receive platform logs, you can consume the resource metrics in IBM Cloud Logs. Use the filter `metric:instance-resources` to filter for log lines that print resource metrics for each detected IBM Cloud Code Engine instance that is running in a project.

### Custom dashboard

Follow the steps below to create a custom dashboard in your IBM Cloud Logs instance, to gain insights into resource consumption metrics.

![Dashboard overview](./images/icl-dashboard-overview.png)

**Setup instructions:**

* Navigate to the "Custom dashboards" view, hover of the "New" button, and click "Import dashboard"

![New dashboard](./images/icl-dashboard-new.png)

* In the "Import" modal, select the file [./setup/ibm-cloud-logs/dashboard-code_engine_resource_consumption_metrics.json](./setup/ibm-cloud-logs/dashboard-code_engine_resource_consumption_metrics.json) located in this repository, and click "Import"

![Import modal](./images/icl-dashboard-import.png)

* Confirm the import by clicking "Import" again

![Import confirmation](./images/icl-dashboard-import-confirm.png)


### Logs view

Follow the steps below to create a Logs view in your IBM Cloud Logs instance, that allows you to drill into individual instance-resources log lines.

![Logs overview](./images/icl-logs-view-overview.png)

**Setup instructions:**

* Filter only log lines related collected istio-proxy logs, by filtering for the following query
```
app:"codeengine" AND message.metric:"instance-resources"
```

![Query](./images/icl-logs-view-query.png)

* In the left bar, click "Add Filter" and add the following filters
    * `Application`
    * `App`
    * `Label.Project`
    * `Message.Component_name`

![Filters](./images/icl-logs-view-filters.png)

* In the top-right corner, click on "Columns" and configure the following columns:
    * `Timestamp`
    * `label.Project`
    * `message.component_type`
    * `message.component_name`
    * `message.message`
    * `Text`

![Columns](./images/icl-logs-view-columns.png)

* Once applied adjust the column widths appropriately

* In the top-right corner, select `1-line` as view mode

* In the graph title it says "**Count** all grouped by **Severity**". Click on `Severity` and select `message.component_name` instead. Furthermore, select `Max` as aggregation metric and choose `message.memory.usage` as aggregation field

![Graph](./images/icl-logs-view-graph.png)

* Save the view

![Save](./images/icl-logs-view-save.png)

* Utilize the custom logs view to drill into HTTP requests

![Logs overview](./images/icl-logs-view-overview.png)

