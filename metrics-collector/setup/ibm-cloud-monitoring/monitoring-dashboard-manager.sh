#!/usr/bin/env bash

# IBM Cloud Monitoring Dashboard Manager
# A unified tool for managing IBM Cloud Monitoring (Sysdig) dashboards
# 
# This script provides functionality to:
# - List monitoring instances (global and by region)
# - List dashboards (name, id, last_updated)
# - Export dashboard by id into a file
# - Create/update dashboard from JSON file
#
# Authentication uses the current IBM Cloud CLI login context

set -euo pipefail

# Script metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"

# Regional endpoints for IBM Cloud Monitoring
declare -A REGION_ENDPOINTS=(
    ["us-south"]="https://us-south.monitoring.cloud.ibm.com"
    ["us-east"]="https://us-east.monitoring.cloud.ibm.com"
    ["eu-de"]="https://eu-de.monitoring.cloud.ibm.com"
    ["eu-es"]="https://eu-es.monitoring.cloud.ibm.com"
    ["eu-gb"]="https://eu-gb.monitoring.cloud.ibm.com"
    ["jp-tok"]="https://jp-tok.monitoring.cloud.ibm.com"
    ["au-syd"]="https://au-syd.monitoring.cloud.ibm.com"
    ["jp-osa"]="https://jp-osa.monitoring.cloud.ibm.com"
    ["ca-tor"]="https://ca-tor.monitoring.cloud.ibm.com"
    ["br-sao"]="https://br-sao.monitoring.cloud.ibm.com"
)

# IBM Cloud Resource Controller API
readonly RESOURCE_CONTROLLER_API="https://resource-controller.cloud.ibm.com/v2"

# Default values
DEFAULT_OUTPUT_DIR="."
DEFAULT_FORMAT="table"

# Global variables
IAM_TOKEN=""
VERBOSE=false

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

#######################################
# Print error message and exit
# Arguments:
#   Error message
#######################################
error() {
    echo -e "${RED}ERROR:${NC} $1" >&2
    exit 1
}

#######################################
# Print warning message
# Arguments:
#   Warning message
#######################################
warn() {
    echo -e "${YELLOW}WARNING:${NC} $1" >&2
}

#######################################
# Print info message
# Arguments:
#   Info message
#######################################
info() {
    echo -e "${BLUE}→${NC} $1"
}

#######################################
# Print success message
# Arguments:
#   Success message
#######################################
success() {
    echo -e "${GREEN}✓${NC} $1"
}

#######################################
# Print verbose message
# Arguments:
#   Message
#######################################
verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1" >&2
    fi
}

#######################################
# Check if required tools are installed
#######################################
check_prerequisites() {
    local missing_tools=()
    
    # Check for required commands
    for cmd in ibmcloud curl jq; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_tools+=("$cmd")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}\nPlease install them and try again."
    fi
    
    verbose "All required tools are installed"
}

#######################################
# Verify IBM Cloud CLI is logged in
#######################################
check_ibmcloud_login() {
    verbose "Checking IBM Cloud CLI login status..."
    
    if ! ibmcloud account show &> /dev/null; then
        error "Not logged in to IBM Cloud CLI. Please run 'ibmcloud login' first."
    fi
    
    verbose "IBM Cloud CLI is logged in"
}

#######################################
# Get IAM token from IBM Cloud CLI
# Returns:
#   IAM token (Bearer token)
#######################################
get_iam_token() {
    if [[ -n "$IAM_TOKEN" ]]; then
        echo "$IAM_TOKEN"
        return
    fi
    
    verbose "Obtaining IAM token from IBM Cloud CLI..."
    
    local token
    token=$(ibmcloud iam oauth-tokens --output JSON 2>/dev/null | jq -r '.iam_token' 2>/dev/null)
    
    if [[ -z "$token" || "$token" == "null" ]]; then
        error "Failed to obtain IAM token. Please ensure you're logged in to IBM Cloud CLI."
    fi
    
    if [[ ! "$token" =~ ^Bearer ]]; then
        error "Invalid token format received from IBM Cloud CLI"
    fi
    
    IAM_TOKEN="$token"
    verbose "IAM token obtained successfully"
    echo "$token"
}

#######################################
# Get monitoring endpoint URL for region
# Arguments:
#   Region name
# Returns:
#   Endpoint URL
#######################################
get_region_endpoint() {
    local region="$1"
    
    if [[ -z "${REGION_ENDPOINTS[$region]:-}" ]]; then
        error "Unsupported region: $region\nSupported regions: ${!REGION_ENDPOINTS[*]}"
    fi
    
    echo "${REGION_ENDPOINTS[$region]}"
}

#######################################
# Make HTTP request with error handling
# Arguments:
#   HTTP method
#   URL
#   Additional curl arguments (optional)
# Returns:
#   Response body
#######################################
http_request() {
    local method="$1"
    local url="$2"
    shift 2
    local curl_args=("$@")
    
    local response
    local http_code
    local temp_file
    temp_file=$(mktemp)
    
    verbose "Making $method request to: $url"
    
    # Make request and capture both response and HTTP code
    http_code=$(curl -s -w "%{http_code}" -o "$temp_file" \
        -X "$method" \
        "$url" \
        "${curl_args[@]}" \
        2>/dev/null || echo "000")
    
    response=$(cat "$temp_file")
    rm -f "$temp_file"
    
    verbose "HTTP response code: $http_code"
    
    # Check for HTTP errors
    if [[ "$http_code" -ge 400 ]] || [[ "$http_code" == "000" ]]; then
        local error_msg="API request failed (HTTP $http_code)"
        if [[ -n "$response" ]]; then
            local api_error
            api_error=$(echo "$response" | jq -r '.message // .error // empty' 2>/dev/null || echo "")
            if [[ -n "$api_error" ]]; then
                error_msg="$error_msg: $api_error"
            fi
        fi
        error "$error_msg"
    fi
    
    echo "$response"
}

#######################################
# List monitoring instances
# Arguments:
#   Region filter (optional)
#   Output format (table|json)
#######################################
list_monitoring_instances() {
    local region_filter="${1:-}"
    local format="${2:-table}"
    
    info "Fetching monitoring instances..."
    
    local token
    token=$(get_iam_token)
    
    local response
    response=$(http_request GET \
        "$RESOURCE_CONTROLLER_API/resource_instances?type=service_instance" \
        -H "Authorization: $token" \
        -H "Content-Type: application/json")
    
    # Filter for sysdig-monitor instances
    local instances
    instances=$(echo "$response" | jq -c '[.resources[] | select(.id | contains("sysdig-monitor"))]')
    
    # Apply region filter if specified
    if [[ -n "$region_filter" ]]; then
        instances=$(echo "$instances" | jq -c --arg region "$region_filter" '[.[] | select(.region_id == $region)]')
    fi
    
    local count
    count=$(echo "$instances" | jq 'length')
    
    if [[ "$count" -eq 0 ]]; then
        warn "No monitoring instances found"
        return
    fi
    
    success "Found $count monitoring instance(s)"
    echo
    
    if [[ "$format" == "json" ]]; then
        echo "$instances" | jq '.'
    else
        # Table format
        echo "$instances" | jq -r '["NAME", "INSTANCE_ID", "REGION", "STATE"], 
            (.[] | [.name, .guid, .region_id, .state]) | @tsv' | column -t -s $'\t'
    fi
}

#######################################
# List dashboards in a monitoring instance
# Arguments:
#   Instance ID
#   Region
#   Output format (table|json)
#######################################
list_dashboards() {
    local instance_id="$1"
    local region="$2"
    local format="${3:-table}"
    
    info "Fetching dashboards from instance $instance_id in region $region..."
    
    local token
    token=$(get_iam_token)
    
    local endpoint
    endpoint=$(get_region_endpoint "$region")
    
    local response
    response=$(http_request GET \
        "$endpoint/api/v3/dashboards" \
        -H "Authorization: $token" \
        -H "IBMInstanceID: $instance_id" \
        -H "Content-Type: application/json")
    
    local dashboards
    dashboards=$(echo "$response" | jq -c '.dashboards // []')
    
    local count
    count=$(echo "$dashboards" | jq 'length')
    
    if [[ "$count" -eq 0 ]]; then
        warn "No dashboards found in this instance"
        return
    fi
    
    success "Found $count dashboard(s)"
    echo
    
    if [[ "$format" == "json" ]]; then
        echo "$dashboards" | jq '.'
    else
        # Table format with ID, Name, and Last Updated
        echo "$dashboards" | jq -r '["ID", "NAME", "LAST_UPDATED"], 
            (.[] | [.id, .name, (.modifiedOn | . / 1000 | strftime("%Y-%m-%dT%H:%M:%S %Z"))]) | @tsv' | column -t -s $'\t'
    fi
}

#######################################
# Find dashboard by name
# Arguments:
#   Instance ID
#   Region
#   Dashboard name
# Returns:
#   Dashboard ID or empty string
#######################################
find_dashboard_by_name() {
    local instance_id="$1"
    local region="$2"
    local name="$3"
    
    verbose "Searching for dashboard: $name"
    
    local token
    token=$(get_iam_token)
    
    local endpoint
    endpoint=$(get_region_endpoint "$region")
    
    local response
    response=$(http_request GET \
        "$endpoint/api/v3/dashboards" \
        -H "Authorization: $token" \
        -H "IBMInstanceID: $instance_id" \
        -H "Content-Type: application/json")
    
    local dashboard_id
    dashboard_id=$(echo "$response" | jq -r --arg name "$name" '.dashboards[] | select(.name == $name) | .id')
    
    echo "$dashboard_id"
}

#######################################
# Export dashboard to JSON file
# Arguments:
#   Instance ID
#   Region
#   Dashboard ID
#   Output file (optional)
#######################################
export_dashboard() {
    local instance_id="$1"
    local region="$2"
    local dashboard_id="$3"
    local output_file="${4:-}"
    
    info "Exporting dashboard $dashboard_id from instance $instance_id..."
    
    local token
    token=$(get_iam_token)
    
    local endpoint
    endpoint=$(get_region_endpoint "$region")
    
    local response
    response=$(http_request GET \
        "$endpoint/api/v3/dashboards/$dashboard_id" \
        -H "Authorization: $token" \
        -H "IBMInstanceID: $instance_id" \
        -H "Content-Type: application/json")
    
    # Extract dashboard object
    local dashboard
    dashboard=$(echo "$response" | jq '.dashboard')
    
    if [[ "$dashboard" == "null" ]]; then
        error "Dashboard not found or invalid response"
    fi

    # Cleanse the dashboard 
    dashboard=$(echo "$dashboard" | jq 'del(.id)')
    dashboard=$(echo "$dashboard" | jq 'del(.teamId)')
    dashboard=$(echo "$dashboard" | jq 'del(.userId)')
    dashboard=$(echo "$dashboard" | jq 'del(.createdOn)')
    dashboard=$(echo "$dashboard" | jq 'del(.modifiedOn)')
    dashboard=$(echo "$dashboard" | jq 'del(.lastAccessedOnByCurrentUser)')
    dashboard=$(echo "$dashboard" | jq 'del(.username)')
    dashboard=$(echo "$dashboard" | jq 'del(.publicToken)')
    
    # Generate output filename if not provided
    if [[ -z "$output_file" ]]; then
        local dashboard_name
        dashboard_name=$(echo "$dashboard" | jq -r '.name // "dashboard"' | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
        local timestamp
        timestamp=$(date -u +"%Y%m%d_%H%M%S")
        output_file="${dashboard_name}_${timestamp}.json"
    fi
    
    # Save to file with pretty printing
    echo "$dashboard" | jq '.' > "$output_file"
    
    success "Dashboard exported successfully to: $output_file"
    
    # Show dashboard info
    local name
    name=$(echo "$dashboard" | jq -r '.name')
    echo
    echo "Dashboard: $name"
    echo "ID: $dashboard_id"
    echo "File: $output_file"
}

#######################################
# Import or update dashboard from JSON file
# Arguments:
#   Instance ID
#   Region
#   JSON file path
#   Update mode (true|false)
#######################################
import_dashboard() {
    local instance_id="$1"
    local region="$2"
    local file="$3"
    local update_mode="${4:-false}"
    
    # Validate file exists
    if [[ ! -f "$file" ]]; then
        error "Dashboard file not found: $file"
    fi
    
    info "Loading dashboard configuration from: $file"
    
    # Load and validate JSON
    local dashboard_config
    if ! dashboard_config=$(jq '.' "$file" 2>/dev/null); then
        error "Invalid JSON in dashboard file: $file"
    fi
    
    # Extract dashboard name
    local dashboard_name
    dashboard_name=$(echo "$dashboard_config" | jq -r '.name // empty')
    
    if [[ -z "$dashboard_name" ]]; then
        error "Dashboard configuration must include a 'name' field"
    fi
    
    info "Dashboard name: $dashboard_name"
    
    local token
    token=$(get_iam_token)
    
    local endpoint
    endpoint=$(get_region_endpoint "$region")
    
    # Check if dashboard already exists
    info "Checking if dashboard already exists..."
    local existing_id
    existing_id=$(find_dashboard_by_name "$instance_id" "$region" "$dashboard_name")
    
    local response
    local dashboard_id
    local operation
    
    if [[ -n "$existing_id" ]]; then
        if [[ "$update_mode" == "true" ]]; then
            info "Dashboard exists (ID: $existing_id). Updating..."
            operation="updated"
            
            # Update existing dashboard
            response=$(http_request PUT \
                "$endpoint/api/v3/dashboards/$existing_id" \
                -H "Authorization: $token" \
                -H "IBMInstanceID: $instance_id" \
                -H "Content-Type: application/json" \
                -d "{\"dashboard\": $dashboard_config}")
            
            dashboard_id="$existing_id"
        else
            error "Dashboard '$dashboard_name' already exists (ID: $existing_id).\nUse --update flag to update the existing dashboard."
        fi
    else
        info "Dashboard does not exist. Creating new dashboard..."
        operation="created"
        
        # Create new dashboard
        response=$(http_request POST \
            "$endpoint/api/v3/dashboards" \
            -H "Authorization: $token" \
            -H "IBMInstanceID: $instance_id" \
            -H "Content-Type: application/json" \
            -d "{\"dashboard\": $dashboard_config}")
        
        dashboard_id=$(echo "$response" | jq -r '.dashboard.id // empty')
        
        if [[ -z "$dashboard_id" ]]; then
            error "Failed to create dashboard: No ID returned"
        fi
    fi
    
    success "Dashboard '$dashboard_name' $operation successfully!"
    echo
    echo "Dashboard ID: $dashboard_id"
    echo "Dashboard URL: $endpoint/#/dashboards/$dashboard_id"
}

#######################################
# Show usage information
#######################################
show_usage() {
    cat << EOF
IBM Cloud Monitoring Dashboard Manager v${SCRIPT_VERSION}

USAGE:
    $SCRIPT_NAME <command> [options]

COMMANDS:
    list-instances              List monitoring instances
    list-dashboards             List dashboards in an instance
    export                      Export a dashboard to JSON file
    import                      Import/create a dashboard from JSON file
    help                        Show this help message

OPTIONS:
    --instance-id ID            Monitoring instance ID (GUID)
    --region REGION             IBM Cloud region
    --dashboard-id ID           Dashboard ID (for export)
    --file FILE                 JSON file path (for import)
    --output FILE               Output file path (for export)
    --format FORMAT             Output format: table or json (default: table)
    --update                    Update existing dashboard (for import)
    --verbose                   Enable verbose output
    --version                   Show version information

EXAMPLES:
    # List all monitoring instances
    $SCRIPT_NAME list-instances

    # List instances in a specific region
    $SCRIPT_NAME list-instances --region us-south

    # List instances in JSON format
    $SCRIPT_NAME list-instances --format json

    # List dashboards in an instance
    $SCRIPT_NAME list-dashboards \\
        --instance-id "12345678-1234-1234-1234-123456789abc" \\
        --region us-south

    # Export a dashboard
    $SCRIPT_NAME export \\
        --instance-id "12345678-1234-1234-1234-123456789abc" \\
        --region us-south \\
        --dashboard-id 12345

    # Export with custom output file
    $SCRIPT_NAME export \\
        --instance-id "12345678-1234-1234-1234-123456789abc" \\
        --region us-south \\
        --dashboard-id 12345 \\
        --output my-dashboard.json

    # Import a new dashboard
    $SCRIPT_NAME import \\
        --instance-id "12345678-1234-1234-1234-123456789abc" \\
        --region us-south \\
        --file dashboard.json

    # Update an existing dashboard
    $SCRIPT_NAME import \\
        --instance-id "12345678-1234-1234-1234-123456789abc" \\
        --region us-south \\
        --file dashboard.json \\
        --update

SUPPORTED REGIONS:
    ${!REGION_ENDPOINTS[*]}

ENVIRONMENT VARIABLES:
    SYSDIG_INSTANCE_ID          Default instance ID
    SYSDIG_REGION               Default region
    SYSDIG_OUTPUT_DIR           Default output directory for exports

AUTHENTICATION:
    This script uses the IBM Cloud CLI login context. Ensure you are logged in:
        ibmcloud login

For more information, see the documentation in the setup/ibm-cloud-monitoring directory.
EOF
}

#######################################
# Show version information
#######################################
show_version() {
    echo "IBM Cloud Monitoring Dashboard Manager v${SCRIPT_VERSION}"
}

#######################################
# Parse command line arguments
#######################################
parse_args() {
    local command="${1:-}"
    
    if [[ -z "$command" ]]; then
        show_usage
        exit 0
    fi
    
    shift
    
    # Parse command
    case "$command" in
        list-instances)
            local region_filter=""
            local format="$DEFAULT_FORMAT"
            
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --region)
                        region_filter="$2"
                        shift 2
                        ;;
                    --format)
                        format="$2"
                        shift 2
                        ;;
                    --verbose)
                        VERBOSE=true
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        ;;
                esac
            done
            
            check_prerequisites
            check_ibmcloud_login
            list_monitoring_instances "$region_filter" "$format"
            ;;
            
        list-dashboards)
            local instance_id="${SYSDIG_INSTANCE_ID:-}"
            local region="${SYSDIG_REGION:-}"
            local format="$DEFAULT_FORMAT"
            
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --instance-id)
                        instance_id="$2"
                        shift 2
                        ;;
                    --region)
                        region="$2"
                        shift 2
                        ;;
                    --format)
                        format="$2"
                        shift 2
                        ;;
                    --verbose)
                        VERBOSE=true
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        ;;
                esac
            done
            
            if [[ -z "$instance_id" ]]; then
                error "Instance ID is required. Use --instance-id or set SYSDIG_INSTANCE_ID environment variable."
            fi
            
            if [[ -z "$region" ]]; then
                error "Region is required. Use --region or set SYSDIG_REGION environment variable."
            fi
            
            check_prerequisites
            check_ibmcloud_login
            list_dashboards "$instance_id" "$region" "$format"
            ;;
            
        export)
            local instance_id="${SYSDIG_INSTANCE_ID:-}"
            local region="${SYSDIG_REGION:-}"
            local dashboard_id=""
            local output_file=""
            
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --instance-id)
                        instance_id="$2"
                        shift 2
                        ;;
                    --region)
                        region="$2"
                        shift 2
                        ;;
                    --dashboard-id)
                        dashboard_id="$2"
                        shift 2
                        ;;
                    --output)
                        output_file="$2"
                        shift 2
                        ;;
                    --verbose)
                        VERBOSE=true
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        ;;
                esac
            done
            
            if [[ -z "$instance_id" ]]; then
                error "Instance ID is required. Use --instance-id or set SYSDIG_INSTANCE_ID environment variable."
            fi
            
            if [[ -z "$region" ]]; then
                error "Region is required. Use --region or set SYSDIG_REGION environment variable."
            fi
            
            if [[ -z "$dashboard_id" ]]; then
                error "Dashboard ID is required. Use --dashboard-id."
            fi
            
            check_prerequisites
            check_ibmcloud_login
            export_dashboard "$instance_id" "$region" "$dashboard_id" "$output_file"
            ;;
            
        import)
            local instance_id="${SYSDIG_INSTANCE_ID:-}"
            local region="${SYSDIG_REGION:-}"
            local file=""
            local update_mode="false"
            
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --instance-id)
                        instance_id="$2"
                        shift 2
                        ;;
                    --region)
                        region="$2"
                        shift 2
                        ;;
                    --file)
                        file="$2"
                        shift 2
                        ;;
                    --update)
                        update_mode="true"
                        shift
                        ;;
                    --verbose)
                        VERBOSE=true
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        ;;
                esac
            done
            
            if [[ -z "$instance_id" ]]; then
                error "Instance ID is required. Use --instance-id or set SYSDIG_INSTANCE_ID environment variable."
            fi
            
            if [[ -z "$region" ]]; then
                error "Region is required. Use --region or set SYSDIG_REGION environment variable."
            fi
            
            if [[ -z "$file" ]]; then
                error "File is required. Use --file."
            fi
            
            check_prerequisites
            check_ibmcloud_login
            import_dashboard "$instance_id" "$region" "$file" "$update_mode"
            ;;
            
        help|--help|-h)
            show_usage
            ;;
            
        version|--version|-v)
            show_version
            ;;
            
        *)
            error "Unknown command: $command\nRun '$SCRIPT_NAME help' for usage information."
            ;;
    esac
}

#######################################
# Main entry point
#######################################
main() {
    parse_args "$@"
}

# Run main function
main "$@"

# Made with Bob
