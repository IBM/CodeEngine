#!/bin/bash

# Load testing script for network-test-app
# Generates random load to produce metric data
# Press Ctrl+C to abort the test

# Configuration
TARGET_URL="${TARGET_URL:-http://localhost:8080}"
DURATION="${DURATION:-60}"
CONCURRENT_REQUESTS="${CONCURRENT_REQUESTS:-5}"

# Track worker PIDs for cleanup
WORKER_PIDS=()
INTERRUPTED=false

# Cleanup function
cleanup() {
  if [ "$INTERRUPTED" = false ]; then
    INTERRUPTED=true
    echo ""
    echo "Aborting load test..."
    
    # Kill all worker processes
    for pid in "${WORKER_PIDS[@]}"; do
      kill "$pid" 2>/dev/null
    done
    
    # Wait for all processes to terminate
    wait 2>/dev/null
    
    echo "Load test aborted!"
    echo "View metrics at: ${TARGET_URL%:*}:2112/metrics"
    exit 0
  fi
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

echo "Load Testing Configuration:"
echo "  Target URL: $TARGET_URL"
echo "  Duration: ${DURATION}s"
echo "  Concurrent requests: $CONCURRENT_REQUESTS"
echo ""
echo "Press Ctrl+C to abort the test"
echo ""

# Endpoints to test
ENDPOINTS=(
  "/"
  "/outbound/delay"
  "/outbound/get"
  "/outbound/status/200"
  "/outbound/status/404"
  "/test-db"
)

# Function to make a random request
make_request() {
  local endpoint=${ENDPOINTS[$RANDOM % ${#ENDPOINTS[@]}]}
  local method="GET"
  
  # POST endpoint
  if [[ "$endpoint" == "/outbound/post" ]]; then
    method="POST"
  fi
  
  local start_time=$(date +%s%N)
  local response_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${TARGET_URL}${endpoint}" 2>/dev/null)
  local end_time=$(date +%s%N)
  local duration=$(( (end_time - start_time) / 1000000 ))
  
  echo "[$(date +%H:%M:%S)] $method $endpoint -> $response_code (${duration}ms)"
}

# Function to run load test worker
run_worker() {
  local worker_id=$1
  local end_time=$(($(date +%s) + DURATION))
  
  while [ $(date +%s) -lt $end_time ] && [ "$INTERRUPTED" = false ]; do
    make_request
    # Random sleep between requests (0.5-2 seconds)
    sleep $(awk -v min=0.5 -v max=2 'BEGIN{srand(); print min+rand()*(max-min)}') 2>/dev/null || break
  done
}

# Start concurrent workers
echo "Starting load test..."
for i in $(seq 1 $CONCURRENT_REQUESTS); do
  run_worker $i &
  WORKER_PIDS+=($!)
done

# Wait for all workers to complete
wait

# Check if we completed normally or were interrupted
if [ "$INTERRUPTED" = false ]; then
  echo ""
  echo "Load test completed!"
  echo "View metrics at: ${TARGET_URL%:*}:2112/metrics"
fi
