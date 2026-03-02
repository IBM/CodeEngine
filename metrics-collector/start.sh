#!/bin/sh
set -e

echo "Starting Code Engine Metrics Collector..."

# Check if METRICS_ENABLED is set to true
if [ "$METRICS_ENABLED" = "true" ]; then
    echo "Prometheus metrics export enabled"
    
    # Check if monitoring API key secret is mounted
    if [ ! -f "/etc/secrets/monitoring-apikey" ]; then
        echo "ERROR: Prometheus agent requires /etc/secrets/monitoring-apikey to be mounted"
        echo "Please create a secret with your IBM Cloud Monitoring API key and mount it at /etc/secrets/monitoring-apikey"
        echo "Example:"
        echo "  ibmcloud ce secret create --name monitoring-apikey --from-literal monitoring-apikey=YOUR_API_KEY"
        echo "  ibmcloud ce job update --name metrics-collector --mount-secret /etc/secrets=monitoring-apikey"
        exit 1
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
