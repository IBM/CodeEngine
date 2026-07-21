#!/bin/bash

set -euo pipefail

echo "Starting Code Engine Sysdig Secure Collector..."

# Initialize environment variables required by the Sysdig workload agent.
# These values are expected to be injected at runtime (e.g. via a Kubernetes
# Secret, a ConfigMap, or a container-platform environment variable binding).
# Override only the variables that are not already set in the environment so
# that values supplied externally (e.g. via `docker run -e …`) take precedence.

# Function to read container resource token from filesystem
read_container_token() {
    local cr_token_filename="${CR_TOKEN_FILENAME:-/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token}"
    
    if [ ! -f "$cr_token_filename" ]; then
        echo "ERROR: Container resource token file not found at $cr_token_filename"
        return 1
    fi
    
    CR_TOKEN=$(cat "$cr_token_filename")
    if [ -z "$CR_TOKEN" ]; then
        echo "ERROR: Container resource token is empty"
        return 1
    fi
    
    echo "Container resource token retrieved successfully"
    return 0
}

# Function to obtain IAM token using container resource token
obtain_iam_token() {
    local cr_token="$1"
    local trusted_profile_name="$2"
    
    if [ -z "$cr_token" ] || [ -z "$trusted_profile_name" ]; then
        echo "ERROR: Missing required parameters for IAM token retrieval"
        return 1
    fi
    
    # Make the request to IAM token endpoint
    local response
    response=$(curl --silent --fail -X POST \
        "https://iam.cloud.ibm.com/identity/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -H "Accept: application/json" \
        --data-urlencode "grant_type=urn:ibm:params:oauth:grant-type:cr-token" \
        --data-urlencode "cr_token=$cr_token" \
        --data-urlencode "profile_name=$trusted_profile_name" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to obtain IAM token from IBM Cloud"
        echo "Response: $response"
        return 1
    fi
    
    # Extract access token from response
    IBM_CLOUD_BEARER_TOKEN=$(echo "$response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$IBM_CLOUD_BEARER_TOKEN" ]; then
        echo "ERROR: Failed to extract access token from IAM response"
        echo "Response: $response"
        return 1
    fi
    
    echo "IAM token obtained successfully"
    return 0
}

# Function to obtain Monitoring API key using IAM token
obtain_monitoring_apikey() {
    local bearer_token="$1"
    local monitoring_region="$2"
    local monitoring_instance_guid="$3"
    
    if [ -z "$bearer_token" ] || [ -z "$monitoring_region" ] || [ -z "$monitoring_instance_guid" ]; then
        echo "ERROR: Missing required parameters for monitoring API key retrieval"
        return 1
    fi
    
    # Fetch monitoring API key
    local response
    response=$(curl --silent --fail -X GET \
        "https://${monitoring_region}.monitoring.cloud.ibm.com/api/token" \
        -H "Authorization: Bearer $bearer_token" \
        -H "IBMInstanceID: $monitoring_instance_guid" \
        -H "content-type: application/json" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to obtain Monitoring API key"
        echo "Response: $response"
        return 1
    fi
    
    # Extract the API key from response
    MONITORING_API_KEY=$(echo "$response" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$MONITORING_API_KEY" ]; then
        echo "ERROR: Failed to extract API key from Monitoring response"
        echo "Response: $response"
        return 1
    fi
    
    echo "Monitoring API key obtained successfully"
    return 0
}

# Main authentication function with fallback logic
authenticate_monitoring() {
    echo "Authenticating to IBM Cloud Monitoring..."
        
    # Step 1: Read container resource token
    if ! read_container_token; then
        echo "WARNING: Failed to read container resource token"
        return 1
    fi
    
    # Step 2: Obtain IAM token
    if ! obtain_iam_token "$CR_TOKEN" "$TRUSTED_PROFILE_NAME"; then
        echo "WARNING: Failed to obtain IAM token"
        return 1
    fi

    # Step 3: Obtain Monitoring API key
    if ! obtain_monitoring_apikey "$IBM_CLOUD_BEARER_TOKEN" "$MONITORING_REGION" "$MONITORING_INSTANCE_GUID"; then
        echo "WARNING: Failed to obtain Monitoring API key"
        return 1
    fi

    # Step 4: Expose the Monitoring API key
    export SYSDIG_ACCESS_KEY="$MONITORING_API_KEY"
    return 0
}

# Check required environment variables
if [ -z "$MONITORING_REGION" ]; then
    echo "ERROR: MONITORING_REGION environment variable is required"
    exit 1
fi

if [ -z "$SYSDIG_ACCESS_KEY" ]; then
    if [ -z "$MONITORING_INSTANCE_GUID" ]; then
        echo "ERROR: MONITORING_INSTANCE_GUID environment variable is required"
        exit 1
    fi
    
    if [ -z "$TRUSTED_PROFILE_NAME" ]; then
        echo "ERROR: TRUSTED_PROFILE_NAME environment variable is required"
        exit 1
    fi

    # Authenticate to IBM Cloud Monitoring (Trusted Profile or mounted secret)
    if ! authenticate_monitoring; then
        exit 1
    fi
    echo "Obtained SYSDIG_ACCESS_KEY: '$SYSDIG_ACCESS_KEY'"
fi

# API key used to authenticate the agent with SCC Workload Protection.
: "${SYSDIG_ACCESS_KEY:?SYSDIG_ACCESS_KEY must be set}"

export SYSDIG_COLLECTOR="ingest.$MONITORING_REGION.monitoring.cloud.ibm.com"
export SYSDIG_WORKLOAD_ID="$HOSTNAME"

# Optional generic metadata string passed to the agent.
# Not mandatory — default to empty string when absent.
export SYSDIG_GENERIC_METADATA="{\"containerName\":\"$HOSTNAME\", \"containerId\":\"$HOSTNAME\",\"image\":\"icr.io/myns/my-instrumented-app:latest\",\"imageId\":\"<sha256>\"}"

# Hand off to the Sysdig instrument binary, forwarding all arguments that were
# supplied to this script (i.e. the CMD / ENTRYPOINT remainder from Docker).
exec /opt/draios/bin/instrument "$@"