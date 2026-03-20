#!/bin/bash

# ==============================
# ENVIRONMENT SETUP
# ==============================

REGION="${REGION:=eu-de}"
NAME_PREFIX="${NAME_PREFIX:=ce-fastmcp}"

ce_project_name=${PROJECT_NAME:-${NAME_PREFIX}-project}
resource_group_name=${NAME_PREFIX}-rg

# ==============================
# COMMON FUNCTIONS
# ==============================

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source "${SCRIPT_DIR}/../common.sh"

# ==============================
# MAIN SCRIPT FLOW
# ==============================

target_region $REGION
target_resource_group $resource_group_name

ibmcloud ce project select -n $ce_project_name


url=$(ibmcloud ce app get --name fastmcp -o json | jq -r '.status.url')
print_msg "\nFastMCP application is reachable under the following url:"
print_msg "\n$url/mcp"

print_msg "\ninitialize session"
session=$(curl -s -o /dev/null -w '%header{mcp-session-id}' -X POST $url/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "curl",
        "version": "1.0.0"
      }
    }
  }')

curl -s -X POST $url/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: $session" \
  -d '{
       "jsonrpc": "2.0",
       "method": "notifications/initialized"
   }'

print_msg "\nSession initialized: $session"

print_msg "\nList tools"
curl -s -X POST  $url/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: $session" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }' | grep "data" | sed s/"data: "//g | jq . 

# Stuttgart coordinates
STUTTGART_LAT=48.7758
STUTTGART_LON=9.1829

print_msg "\n=========================================="
print_msg "WEATHER TOOLS DEMONSTRATION FOR STUTTGART"
print_msg "==========================================\n"

print_msg "\n1. Search for 'Stuttgart' location"
curl -s -X POST  $url/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: $session" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_location",
      "arguments": {
        "query": "Stuttgart"
      }
    }
  }' | grep "data" | sed s/"data: "//g | jq -r ".result.content[0].text"

print_msg "\n2. Get current weather for Stuttgart"
curl -s -X POST  $url/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: $session" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_current_weather\",
      \"arguments\": {
        \"latitude\": $STUTTGART_LAT,
        \"longitude\": $STUTTGART_LON
      }
    }
  }" | grep "data" | sed s/"data: "//g | jq -r ".result.content[0].text"

print_msg "\n3. Get 7-day weather forecast for Stuttgart"
curl -s -X POST  $url/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Accept: text/event-stream" \
  -H "Mcp-Session-Id: $session" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_weather_forecast\",
      \"arguments\": {
        \"latitude\": $STUTTGART_LAT,
        \"longitude\": $STUTTGART_LON,
        \"days\": 7
      }
    }
  }" | grep "data" | sed s/"data: "//g | jq -r ".result.content[0].text"



print_success "\n=========================================="
print_success " SUCCESS"
print_success "==========================================\n"
print_msg "\n"
