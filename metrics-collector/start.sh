#!/bin/sh
set -e

echo "Starting Code Engine Metrics Collector..."

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
    
    # Check if Trusted Profile authentication is configured
    if [ -n "$MONITORING_INSTANCE_GUID" ] && [ -n "$MONITORING_REGION" ] && [ -n "$TRUSTED_PROFILE_NAME" ]; then
        echo "Attempting Trusted Profile authentication..."
        
        # Step 1: Read container resource token
        if ! read_container_token; then
            echo "WARNING: Failed to read container resource token"
            echo "Falling back to mounted secret..."
        else
            # Step 2: Obtain IAM token
            if ! obtain_iam_token "$CR_TOKEN" "$TRUSTED_PROFILE_NAME"; then
                echo "WARNING: Failed to obtain IAM token"
                echo "Falling back to mounted secret..."
            else
                # Step 3: Obtain Monitoring API key
                if ! obtain_monitoring_apikey "$IBM_CLOUD_BEARER_TOKEN" "$MONITORING_REGION" "$MONITORING_INSTANCE_GUID"; then
                    echo "WARNING: Failed to obtain Monitoring API key"
                    echo "Falling back to mounted secret..."
                else
                    # Step 4: Write API key to file
                    echo "$MONITORING_API_KEY" > /etc/secrets/monitoring-apikey
                    if [ $? -eq 0 ]; then
                        echo "Monitoring API key written to /etc/secrets/monitoring-apikey"
                        return 0
                    else
                        echo "ERROR: Failed to write Monitoring API key to file"
                        echo "Falling back to mounted secret..."
                    fi
                fi
            fi
        fi
    fi
    
    # Fallback: Check for mounted secret
    if [ -f "/etc/secrets/monitoring-apikey" ]; then
        echo "Using mounted monitoring API key secret"
        return 0
    fi
    
    # Neither method available
    echo "ERROR: No valid authentication method available"
    echo ""
    echo "Please configure one of the following:"
    echo ""
    echo "Option 1: Trusted Profile Authentication (Recommended)"
    echo "  Set the following environment variables:"
    echo "    - MONITORING_INSTANCE_GUID"
    echo "    - MONITORING_REGION"
    echo "    - TRUSTED_PROFILE_NAME"
    echo ""
    echo "Option 2: Explicit API Key Secret"
    echo "  Mount a secret containing your Monitoring API key:"
    echo "    ibmcloud ce secret create --name monitoring-apikey --from-literal monitoring-apikey=YOUR_API_KEY"
    echo "    ibmcloud ce job update --name metrics-collector --mount-secret /etc/secrets=monitoring-apikey"
    echo ""
    return 1
}

# Check if METRICS_ENABLED is set to true
if [ "$METRICS_ENABLED" = "true" ]; then
    echo "Prometheus metrics export enabled"
    
    # Authenticate to IBM Cloud Monitoring (Trusted Profile or mounted secret)
    if ! authenticate_monitoring; then
        exit 0
    fi
    
    # Check required environment variables
    if [ -z "$CE_SUBDOMAIN" ]; then
        echo "ERROR: CE_SUBDOMAIN environment variable is required when METRICS_ENABLED=true"
        exit 1
    fi
    
    if [ -z "$METRICS_REMOTE_WRITE_FQDN" ]; then
        echo "ERROR: METRICS_REMOTE_WRITE_FQDN environment variable is required when METRICS_ENABLED=true"
        exit 1
    fi

    if [ -z "$CE_PROJECT_NAME" ]; then
        CE_PROJECT_NAME="default"
    fi
    
    # Generate prometheus.yml from template with environment variable substitution
    echo "Generating Prometheus configuration..."
    sed -e "s/\${CE_SUBDOMAIN}/$CE_SUBDOMAIN/g" \
        -e "s/\${CE_PROJECT_NAME}/$CE_PROJECT_NAME/g" \
        -e "s/\${METRICS_REMOTE_WRITE_FQDN}/$METRICS_REMOTE_WRITE_FQDN/g" \
        /etc/prometheus/prometheus.yml.template > /tmp/prometheus.yml

    echo "Starting Prometheus agent..."
    /bin/prometheus --config.file=/tmp/prometheus.yml --agent --storage.agent.path=/tmp/agent-data --log.level info --log.format json 2>&1 &
    PROMETHEUS_PID=$!
    echo "Prometheus agent started with PID $PROMETHEUS_PID"
    
    # Give Prometheus a moment to start and check if it's actually running
    sleep 2
    if ! kill -0 "$PROMETHEUS_PID" 2>/dev/null; then
        echo "ERROR: Prometheus agent failed to start"
        exit 1
    fi
else
    echo "Prometheus metrics export disabled (METRICS_ENABLED not set to 'true')"
fi

# Start the metrics collector
echo "Starting metrics collector..."
/app &
APP_PID=$!
echo "Metrics collector started with PID $APP_PID"

# Function to handle shutdown
shutdown() {
    echo "Shutting down..."
    if [ -n "$APP_PID" ]; then
        kill -TERM "$APP_PID" 2>/dev/null || true
    fi
    if [ -n "$PROMETHEUS_PID" ]; then
        kill -TERM "$PROMETHEUS_PID" 2>/dev/null || true
    fi
    wait
    exit 0
}

# Trap signals
trap shutdown SIGTERM SIGINT

# Monitor processes
while true; do
    # Check if app is still running
    if ! kill -0 "$APP_PID" 2>/dev/null; then
        echo "ERROR: Metrics collector process died unexpectedly"
        if [ -n "$APP_PID" ]; then
            kill -TERM "$APP_PID" 2>/dev/null || true
        fi
        exit 1
    fi
    
    # Check if Prometheus is still running (only if it was started)
    if [ "$METRICS_ENABLED" = "true" ] && ! kill -0 "$PROMETHEUS_PID" 2>/dev/null; then
        echo "ERROR: Prometheus agent process died unexpectedly"
        kill -TERM "$PROMETHEUS_PID" 2>/dev/null || true
        exit 1
    fi
    
    sleep 5
done
