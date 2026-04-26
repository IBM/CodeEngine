# IBM Cloud Monitoring Dashboard Setup

This directory contains tools and dashboards for IBM Cloud Monitoring (Sysdig) integration.

## Files

- **`monitoring-dashboard-manager.sh`**: Unified bash script for managing dashboards (recommended)
- **`code-engine-component-resource-overview.json`**: Dashboard configuration for Code Engine resource monitoring

## Quick Start

### Prerequisites

1. **IBM Cloud CLI** installed and logged in
2. **jq** (JSON processor) installed
3. **curl** installed (usually pre-installed)
4. An IBM Cloud Monitoring (Sysdig) instance

### Installation

The bash script is ready to use. Make it executable if needed:

```bash
chmod +x monitoring-dashboard-manager.sh
```

### Basic Usage

```bash
# Show help
./monitoring-dashboard-manager.sh help

# List all monitoring instances
./monitoring-dashboard-manager.sh list-instances

# List dashboards in an instance
./monitoring-dashboard-manager.sh list-dashboards \
    --instance-id "YOUR_INSTANCE_ID" \
    --region us-south

# Export a dashboard
./monitoring-dashboard-manager.sh export \
    --instance-id "YOUR_INSTANCE_ID" \
    --region us-south \
    --dashboard-id 12345

# Import/create a dashboard
./monitoring-dashboard-manager.sh import \
    --instance-id "YOUR_INSTANCE_ID" \
    --region us-south \
    --file code-engine-component-resource-overview.json
```

## Bash Script: monitoring-dashboard-manager.sh

The unified bash script provides all dashboard management functionality using IBM Cloud CLI authentication.

### Features

- ✅ List monitoring instances (global and by region)
- ✅ List dashboards with name, ID, and last updated timestamp
- ✅ Export dashboards to JSON files
- ✅ Create new dashboards from JSON files
- ✅ Update existing dashboards
- ✅ Uses IBM Cloud CLI login context (no API key needed)
- ✅ Comprehensive error handling
- ✅ Table and JSON output formats
- ✅ Verbose mode for debugging

### Authentication

The script uses your current IBM Cloud CLI login session. Ensure you're logged in:

```bash
ibmcloud login
```

The script automatically retrieves the IAM token using:
```bash
ibmcloud iam oauth-tokens --output JSON | jq -r '.iam_token'
```

### Commands

#### List Monitoring Instances

List all monitoring instances in your account:

```bash
# List all instances
./monitoring-dashboard-manager.sh list-instances

# List instances in a specific region
./monitoring-dashboard-manager.sh list-instances --region us-south

# Output in JSON format
./monitoring-dashboard-manager.sh list-instances --format json
```

#### List Dashboards

List all dashboards in a monitoring instance:

```bash
./monitoring-dashboard-manager.sh list-dashboards \
    --instance-id "12345678-1234-1234-1234-123456789abc" \
    --region us-south

# JSON format
./monitoring-dashboard-manager.sh list-dashboards \
    --instance-id "12345678-1234-1234-1234-123456789abc" \
    --region us-south \
    --format json
```

#### Export Dashboard

Export a dashboard to a JSON file:

```bash
# Export with auto-generated filename
./monitoring-dashboard-manager.sh export \
    --instance-id "12345678-1234-1234-1234-123456789abc" \
    --region us-south \
    --dashboard-id 12345

# Export with custom filename
./monitoring-dashboard-manager.sh export \
    --instance-id "12345678-1234-1234-1234-123456789abc" \
    --region us-south \
    --dashboard-id 12345 \
    --output my-dashboard.json
```

#### Import/Create Dashboard

Import a dashboard from a JSON file:

```bash
# Create new dashboard
./monitoring-dashboard-manager.sh import \
    --instance-id "12345678-1234-1234-1234-123456789abc" \
    --region us-south \
    --file code-engine-component-resource-overview.json

# Update existing dashboard (by name)
./monitoring-dashboard-manager.sh import \
    --instance-id "12345678-1234-1234-1234-123456789abc" \
    --region us-south \
    --file code-engine-component-resource-overview.json \
    --update
```

### Environment Variables

You can set default values using environment variables:

```bash
export SYSDIG_INSTANCE_ID="12345678-1234-1234-1234-123456789abc"
export SYSDIG_REGION="us-south"

# Now you can omit --instance-id and --region
./monitoring-dashboard-manager.sh list-dashboards
```

### Supported Regions

- `us-south` - US South (Dallas)
- `us-east` - US East (Washington DC)
- `eu-de` - EU Central (Frankfurt)
- `eu-es` - EU Spain (Madrid)
- `eu-gb` - EU GB (London)
- `jp-tok` - Japan (Tokyo)
- `jp-osa` - Japan (Osaka)
- `au-syd` - Australia (Sydney)
- `ca-tor` - Canada (Toronto)
- `br-sao` - Brazil (São Paulo)

### Verbose Mode

Enable verbose output for debugging:

```bash
./monitoring-dashboard-manager.sh list-instances --verbose
```

## Dashboard: Code Engine Container Resource Overview

The `code-engine-component-resource-overview.json` dashboard provides comprehensive monitoring of Code Engine resources.

### Panels

1. **CPU Usage vs Limit (per Pod)** - Compares live CPU usage to configured limits
2. **CPU Utilization % (per App)** - CPU percentage by component
3. **Memory Usage vs Limit (per Pod)** - Compares memory usage to limits
4. **Memory Utilization % (per App)** - Memory percentage by component
5. **CPU Utilization % (per Namespace)** - Namespace-level CPU monitoring
6. **Memory Utilization % (per Namespace)** - Namespace-level memory monitoring
7. **CPU Utilization % (per Revision/Parent)** - Revision-level CPU tracking
8. **Memory Utilization % (per Revision/Parent)** - Revision-level memory tracking
9. **Top Pods by CPU** - Top 10 CPU consumers
10. **Top Pods by Memory** - Top 10 memory consumers
11. **Cluster CPU Utilization (%)** - Global CPU percentage
12. **Cluster Memory Utilization (%)** - Global memory percentage

### Required Metrics

The dashboard uses the following Prometheus metrics:

- `codeengine_container_cpu_usage_millicores`
- `codeengine_container_cpu_limit_millicores`
- `codeengine_container_memory_usage_bytes`
- `codeengine_container_memory_limit_bytes`

These metrics are exposed by the Code Engine metrics collector when running with `METRICS_ENABLED=true`.

## Getting Your IBM Cloud Credentials

### IBM Cloud IAM API Key (for Python scripts)

1. Log in to [IBM Cloud Console](https://cloud.ibm.com)
2. Go to **Manage** > **Access (IAM)** > **API keys**
3. Click **Create an IBM Cloud API key**
4. Give it a name and description
5. Copy and save the API key securely

### Monitoring Instance ID

1. Navigate to your IBM Cloud Monitoring instance
2. Click on **Overview** or **Settings**
3. Copy the **Instance ID** (GUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Region

Note the region where your Monitoring instance is deployed (e.g., `us-south`, `eu-de`)

## Complete Example Workflow

```bash
# 1. Ensure you're logged in to IBM Cloud
ibmcloud login

# 2. List your monitoring instances to find the instance ID
./monitoring-dashboard-manager.sh list-instances

# Example output:
# NAME                    INSTANCE_ID                           REGION     STATE
# my-monitoring-instance  12345678-1234-1234-1234-123456789abc  us-south   active

# 3. Set environment variables for convenience
export SYSDIG_INSTANCE_ID="12345678-1234-1234-1234-123456789abc"
export SYSDIG_REGION="us-south"

# 4. List existing dashboards
./monitoring-dashboard-manager.sh list-dashboards

# 5. Import the Code Engine dashboard
./monitoring-dashboard-manager.sh import \
    --file code-engine-component-resource-overview.json

# Output:
# → Loading dashboard configuration from: code-engine-component-resource-overview.json
# → Dashboard name: IBM Code Engine - Container Resource Overview
# → Checking if dashboard already exists...
# → Dashboard does not exist. Creating new dashboard...
# ✓ Dashboard 'IBM Code Engine - Container Resource Overview' created successfully!
#
# Dashboard ID: 12345
# Dashboard URL: https://us-south.monitoring.cloud.ibm.com/#/dashboards/12345

# 6. Later, update the dashboard with changes
./monitoring-dashboard-manager.sh import \
    --file code-engine-component-resource-overview.json \
    --update

# 7. Export a dashboard for backup
./monitoring-dashboard-manager.sh export --dashboard-id 12345
```

## Troubleshooting

### Authentication Errors

**Error: "Not logged in to IBM Cloud CLI"**
- Solution: Run `ibmcloud login` to authenticate

**Error: "Failed to obtain IAM token"**
- Solution: Ensure you're logged in and your session hasn't expired
- Try: `ibmcloud iam oauth-tokens` to verify token generation

### Missing Tools

**Error: "Missing required tools: jq"**
- macOS: `brew install jq`
- Ubuntu/Debian: `sudo apt-get install jq`
- RHEL/CentOS: `sudo yum install jq`

**Error: "Missing required tools: ibmcloud"**
- Install IBM Cloud CLI: https://cloud.ibm.com/docs/cli?topic=cli-install-ibmcloud-cli

### Dashboard Not Showing Data

If the dashboard shows no data:
- Verify the metrics collector is running with `METRICS_ENABLED=true`
- Check that metrics are being sent to IBM Cloud Monitoring
- Ensure the Prometheus remote write configuration is correct
- Wait a few minutes for data to appear (initial scrape interval)

### Import Errors

**Error: "Dashboard configuration must include a 'name' field"**
- Ensure your JSON file has a `name` field at the top level

**Error: "Dashboard 'X' already exists"**
- Use the `--update` flag to update the existing dashboard
- Or rename the dashboard in the JSON file

### API Errors

**Error: "API request failed (HTTP 403)"**
- Verify you have access to the monitoring instance
- Check that the instance ID is correct
- Ensure your IBM Cloud account has the necessary permissions

**Error: "API request failed (HTTP 404)"**
- Verify the instance ID and region are correct
- Check that the dashboard ID exists (for export operations)

## Additional Resources

- [IBM Cloud Monitoring Documentation](https://cloud.ibm.com/docs/monitoring)
- [Sysdig Dashboard API](https://docs.sysdig.com/en/docs/developer-tools/sysdig-rest-api-conventions/)
- [PromQL Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [IBM Cloud CLI Documentation](https://cloud.ibm.com/docs/cli)

## Contributing

When making changes to the dashboard or scripts:

1. Test thoroughly with a real IBM Cloud Monitoring instance
2. Update this README with any new features or changes
3. Ensure backward compatibility where possible
4. Document any breaking changes clearly
