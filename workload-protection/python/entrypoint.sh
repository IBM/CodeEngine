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

# Function to obtain the Access Key of the WLP instance using IAM token
obtain_wlp_access_key() {
    local bearer_token="$1"
    local wlp_region="$2"
    local wlp_instance_guid="$3"
    
    if [ -z "$bearer_token" ] || [ -z "$wlp_region" ] || [ -z "$wlp_instance_guid" ]; then
        echo "ERROR: Missing required parameters for WLP Access Key retrieval"
        return 1
    fi
    
    # Fetch WLP Access key
    local response
    response=$(curl --silent --fail -X GET \
        "https://private.${wlp_region}.security-compliance-secure.cloud.ibm.com/platform/v1/access-keys" \
        -H "Authorization: Bearer $bearer_token" \
        -H "IBMInstanceID: $wlp_instance_guid" \
        -H "content-type: application/json" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to obtain WLP Access Key"
        echo "Response: $response"
        return 1
    fi
    
    # Extract the API key from response
    ACCESS_KEY=$(echo "$response" | grep -o '"accessKey":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$ACCESS_KEY" ]; then
        echo "ERROR: Failed to extract Access key from WLP API response"
        echo "Response: $response"
        return 1
    fi
    
    echo "Access Key key obtained successfully"
    return 0
}

# Main authentication function
authenticate_wlp() {
    echo "Authenticating to IBM Cloud Workload Protection instance ..."
        
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

    # Step 3: Obtain Sysdig Secure Access Key
    if ! obtain_wlp_access_key "$IBM_CLOUD_BEARER_TOKEN" "$WLP_REGION" "$WLP_INSTANCE_GUID"; then
        echo "WARNING: Failed to obtain Workload Protection Access Key"
        return 1
    fi

    # Step 4: Expose the Access Key
    export SYSDIG_ACCESS_KEY="$ACCESS_KEY"
    return 0
}

# Check required environment variables
if [ -z "${WLP_REGION:-}" ]; then
    echo "ERROR: WLP_REGION environment variable is required"
    exit 1
fi

if [ -z "${SYSDIG_ACCESS_KEY:-}" ]; then
    if [ -z "$WLP_INSTANCE_GUID" ]; then
        echo "ERROR: WLP_INSTANCE_GUID environment variable is required"
        exit 1
    fi
    
    if [ -z "${TRUSTED_PROFILE_NAME:-}" ]; then
        echo "ERROR: TRUSTED_PROFILE_NAME environment variable is required"
        exit 1
    fi

    # Authenticate to IBM Security and Compliance Center Workload Protection (Trusted Profile or mounted secret)
    if ! authenticate_wlp; then
        exit 1
    fi
    echo "Obtained SYSDIG_ACCESS_KEY: '$SYSDIG_ACCESS_KEY'"
fi

# API key used to authenticate the agent with SCC Workload Protection.
: "${SYSDIG_ACCESS_KEY:?SYSDIG_ACCESS_KEY must be set}"

export SYSDIG_COLLECTOR="ingest.private.$WLP_REGION.security-compliance-secure.cloud.ibm.com"
export SYSDIG_WORKLOAD_ID="$HOSTNAME"
#export SYSDIG_API_ENDPOINT="private.$WLP_REGION.security-compliance-secure.cloud.ibm.com"
export SYSDIG_ADDITIONAL_CONF="log:\n    console_priority: error\n    file_priority: error"


# FIXME
# agent logs clear text monitoring_apikey: customer_id: "2a46f195-eba7-4172-848f-616e3ed2680b"  

# Optional generic metadata string passed to the agent.
# Not mandatory — default to empty string when absent.
export SYSDIG_GENERIC_METADATA="{\"containerName\":\"$HOSTNAME\", \"containerId\":\"$HOSTNAME\",\"image\":\"icr.io/myns/my-instrumented-app:latest\",\"imageId\":\"<sha256>\"}"

# Hand off to the Sysdig instrument binary, forwarding all arguments that were
# supplied to this script (i.e. the CMD / ENTRYPOINT remainder from Docker).
exec /opt/draios/bin/instrument "$@"