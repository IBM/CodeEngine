# IBM Cloud Monitoring Dashboard Setup

This directory contains tools and dashboards for IBM Cloud Monitoring (Sysdig) integration.

## Files

- **`import_dashboard.py`**: Python script to create or update Sysdig dashboards
- **`code-engine-component-resource-overview.json`**: Dashboard configuration for Code Engine resource monitoring

## Prerequisites

1. **Python 3.6+** installed on your system

2. **IBM Cloud Account** with:
   - An IBM Cloud Monitoring (Sysdig) instance
   - An IBM Cloud IAM API key with access to the Monitoring instance
   - The Monitoring instance ID (GUID)

3. **Metrics Data**: The dashboard expects metrics from the Code Engine metrics collector to be available in your Sysdig instance

### Getting Your IBM Cloud Credentials

**IBM Cloud IAM API Key:**
1. Log in to [IBM Cloud Console](https://cloud.ibm.com)
2. Go to **Manage** > **Access (IAM)** > **API keys**
3. Click **Create an IBM Cloud API key**
4. Give it a name and description
5. Copy and save the API key securely

**Monitoring Instance ID:**
1. Navigate to your IBM Cloud Monitoring instance
2. Click on **Overview** or **Settings**
3. Copy the **Instance ID** (GUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Region:**
- Note the region where your Monitoring instance is deployed (e.g., `us-south`, `eu-de`)

## Setup

### Using a Virtual Environment (Recommended)

It's recommended to use a Python virtual environment to isolate dependencies:

```bash
# Navigate to the setup directory
cd setup/ibm-cloud-monitoring

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install required dependencies
pip install requests

# You should now see (venv) in your terminal prompt
```

When you're done, deactivate the virtual environment:
```bash
deactivate
```

### Global Installation (Alternative)

If you prefer to install dependencies globally:

```bash
pip install requests
# or
pip3 install requests
```

## Usage

### Import or Update Dashboard

```bash
python import_dashboard.py \
    --iam-api-key YOUR_IBM_CLOUD_IAM_API_KEY \
    --instance-id YOUR_MONITORING_INSTANCE_ID \
    --region us-south \
    --dashboard code-engine-component-resource-overview.json
```

### Using Environment Variables

```bash
export IBM_CLOUD_IAM_API_KEY=YOUR_IBM_CLOUD_IAM_API_KEY
export SYSDIG_INSTANCE_ID=YOUR_MONITORING_INSTANCE_ID
export SYSDIG_REGION=us-south
python import_dashboard.py --dashboard code-engine-component-resource-overview.json
```

### Supported Regions

- `us-south` - US South (Dallas)
- `us-east` - US East (Washington DC)
- `eu-de` - EU Central (Frankfurt)
- `eu-gb` - EU GB (London)
- `jp-tok` - Japan (Tokyo)
- `au-syd` - Australia (Sydney)
- `jp-osa` - Japan (Osaka)
- `ca-tor` - Canada (Toronto)
- `br-sao` - Brazil (São Paulo)

## Dashboard: Code Engine Container Resource Overview

The `code-engine-component-resource-overview.json` dashboard provides comprehensive monitoring of Code Engine resources:

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

## Script Features

The `import_dashboard.py` script:

- ✅ Creates new dashboards if they don't exist
- ✅ Updates existing dashboards with the same name
- ✅ Validates API credentials and region
- ✅ Provides clear error messages
- ✅ Displays dashboard URL after creation/update

## Troubleshooting

### Authentication Errors

If you get authentication errors, verify:
- Your IBM Cloud IAM API key is correct and not expired
- The IAM API key has permissions to access the Monitoring instance
- The Monitoring instance ID is correct
- You're using the correct region where the instance is deployed

### Dashboard Not Showing Data

If the dashboard shows no data:
- Verify the metrics collector is running with `METRICS_ENABLED=true`
- Check that metrics are being sent to IBM Cloud Monitoring
- Ensure the Prometheus remote write configuration is correct
- Wait a few minutes for data to appear (initial scrape interval)

### Import Errors

If the import fails:
- Check that the JSON file is valid
- Ensure you have network connectivity to IBM Cloud
- Verify the region endpoint is accessible

## Example: Complete Setup with Virtual Environment

```bash
# 1. Navigate to the setup directory
cd setup/ibm-cloud-monitoring

# 2. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install requests

# 4. Set environment variables
export IBM_CLOUD_IAM_API_KEY=your-iam-api-key-here
export SYSDIG_INSTANCE_ID=your-instance-id-here
export SYSDIG_REGION=us-south

# 5. Import the dashboard
python import_dashboard.py --dashboard code-engine-component-resource-overview.json

# Output:
# Loading dashboard configuration from 'code-engine-component-resource-overview.json'...
# Obtaining IBM Cloud IAM access token...
# ✓ IAM access token obtained successfully
# Checking if dashboard 'IBM Code Engine - Container Resource Overview' exists...
# Dashboard 'IBM Code Engine - Container Resource Overview' not found. Creating new dashboard...
# ✓ Dashboard 'IBM Code Engine - Container Resource Overview' created successfully (ID: 12345)!
#
# Dashboard URL: https://us-south.monitoring.cloud.ibm.com/#/dashboards/12345
#
# ✓ Operation completed successfully!

# 6. Deactivate virtual environment when done
deactivate
```

## Example: Quick Run (Without Virtual Environment)

```bash
# 1. Install dependencies globally
pip3 install requests

# 2. Run the script
cd setup/ibm-cloud-monitoring
python3 import_dashboard.py \
    --iam-api-key your-iam-api-key-here \
    --instance-id your-instance-id-here \
    --region us-south \
    --dashboard code-engine-component-resource-overview.json
```

## Customizing Dashboards

To customize the dashboard:

1. Edit `code-engine-component-resource-overview.json`
2. Modify panel queries, layouts, or add new panels
3. Run the import script to update the dashboard

The script will detect the existing dashboard by name and update it with your changes.

## Additional Resources

- [IBM Cloud Monitoring Documentation](https://cloud.ibm.com/docs/monitoring)
- [Sysdig Dashboard API](https://docs.sysdig.com/en/docs/developer-tools/sysdig-rest-api-conventions/)
- [PromQL Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)