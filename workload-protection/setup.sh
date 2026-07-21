#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

REGION="${REGION:=eu-es}"
NAME_PREFIX="${NAME_PREFIX:=ce-wlp-sample}"
resource_group_name="${NAME_PREFIX}--rg"

ceproject_name="${NAME_PREFIX}-ce"
appconfig_name="${NAME_PREFIX}-appconfig"
sysdig_name="${NAME_PREFIX}-sysdig"
wlp_trusted_profile_name="${NAME_PREFIX}-tp-for-wlp"
ce_trusted_profile_name="${NAME_PREFIX}-tp-for-ce"

echo ""

# ==============================
# COMMON FUNCTIONS
# ==============================
RED="\033[31m"
BLUE="\033[94m"
GREEN="\033[32m"
ENDCOLOR="\033[0m"

function print_error {
    echo -e "${RED}\n==========================================${ENDCOLOR}"
    echo -e "${RED} FAILED${ENDCOLOR}"
    echo -e "${RED}==========================================\n${ENDCOLOR}"
    echo -e "${RED}$1${ENDCOLOR}"
    echo ""
}
function print_msg {
    echo -e "${BLUE}$1${ENDCOLOR}"
}
function print_success {
    echo -e "${GREEN}$1${ENDCOLOR}"
}

# Helper function to check whether prerequisites are installed
function check_prerequisites {
    # Ensure that jq tool is installed
    if ! command -v jq &>/dev/null; then
        print_error "'jq' tool is not installed"
        exit 1
    fi
}


# helper function to check whether IBM Cloud CLI plugins should get updated, or not
function ensure_plugin_is_up_to_date() {
    echo "Checking $1 ..."
    # check whether plugin is installed
    if ! ibmcloud plugin show $1 -q >/dev/null; then
        # install it
        ibmcloud plugin install $1 -f --quiet
    else 
        # check whether there is an update available
        ibmcloud plugin update $1 -f --quiet
    fi
}

function target_region {
    print_msg "\nTargetting IBM Cloud region '$1' ..."
    current_region=$(ibmcloud target --output JSON |jq -r '.region|.name')
    if [[ "$current_region" != "$1" ]]; then
        ibmcloud target -r $1 --quiet
    fi
}

function target_resource_group {
    print_msg "\nTargetting resource group '$1' ..."
    current_resource_group_guid=$(ibmcloud target --output JSON |jq -r '.resource_group|.guid')
    new_resource_group_guid=$(ibmcloud resource group $1 -output json|jq -r '.[0].id')
    if [[ "$current_resource_group_guid" != "$new_resource_group_guid" ]]; then
        ibmcloud target -g $1 --quiet
    fi
}

function does_instance_exist {
    (( $(ibmcloud resource search "service_name:\"$1\" AND name:\"$2\"" --output JSON|jq -r '.items|length') > 0 ))
}


# ==============================
# MAIN SCRIPT FLOW
# ==============================

print_msg "\n=========================================================="
print_msg " Setting up \"Code Engine - SCC Workload Protection\" sample"
print_msg "==========================================================\n"

echo ""
echo "Please note: This script will install various IBM Cloud resources within the resource group '$resource_group_name'."

print_msg "\nChecking prerequisites ..."
check_prerequisites

# Ensure that latest versions of used IBM Cloud CLI is installed
print_msg "\nPulling latest IBM Cloud CLI release ..."
ibmcloud update --force

# Ensure that latest versions of used IBM Cloud CLI plugins are installed
print_msg "\nInstalling required IBM Cloud CLI plugins ..."
ensure_plugin_is_up_to_date code-engine

print_msg "\nPrinting account information ..."
ibmcloud account show

target_region $REGION

#
# Create the resource group, if it does not exist
if ! ibmcloud resource group $resource_group_name >/dev/null 2>&1; then
    print_msg "\nCreating resource group '$resource_group_name' ..."
    ibmcloud resource group-create $resource_group_name
fi
target_resource_group $resource_group_name

#
# Setup AppConfig
if ! does_instance_exist apprapp "$appconfig_name"; then 
    print_msg "\nCreating the IBM Cloud AppConfig '$appconfig_name' ..."
    if ! ibmcloud resource service-instance-create "$appconfig_name" apprapp basic $REGION -p '{"private_endpoints_only": true}'; then 
        print_error "IBM Cloud AppConfig creation failed!"
        abortScript
    fi
fi
APPCONFIG_INSTANCE_JSON="$(ibmcloud resource service-instance "$appconfig_name" -o json)"
APPCONFIG_INSTANCE_CRN="$(echo "$APPCONFIG_INSTANCE_JSON"|jq -r '.[0].crn')"
print_msg "\nAppConfig instance details" 
echo "   crn: '$APPCONFIG_INSTANCE_CRN'"

#
# Create the IAM Trusted Profile
if ! ibmcloud iam trusted-profile $wlp_trusted_profile_name >/dev/null 2>&1; then
    print_msg "\nCreating the IAM Trusted Profile '$wlp_trusted_profile_name' ..."
    ibmcloud iam trusted-profile-create $wlp_trusted_profile_name \
        --description "Trusted profile for Code Engine metrics collector"
    ibmcloud iam trusted-profile-policy-create $wlp_trusted_profile_name \
        --roles Viewer,"Usage Report Viewer" \
        --service-name enterprise 
    ibmcloud iam trusted-profile-policy-create $wlp_trusted_profile_name \
        --roles "Service Configuration Reader",Viewer,"Configuration Aggregator Reader" \
        --service-name apprapp 
fi
TRUSTED_PROFILE_JSON="$(ibmcloud iam trusted-profile "$wlp_trusted_profile_name" -o json)"
TRUSTED_PROFILE_ID="$(echo "$TRUSTED_PROFILE_JSON"|jq -r '.[0].id')"
print_msg "\nTrusted Profile details" 
echo "   id: '$TRUSTED_PROFILE_ID'"

#
# Setup WLP (sysdig secure)
if ! does_instance_exist sysdig-secure "$sysdig_name"; then 
    ACCOUNT_ID="$(ibmcloud account show --output json|jq -r '.account_id')"
    if ! ibmcloud resource service-instance-create "$sysdig_name" sysdig-secure graduated-tier $REGION -p "{\"enable_cspm\": true, \"target_accounts\": [{\"account_id\": \"$ACCOUNT_ID\", \"config_crn\": \"$APPCONFIG_INSTANCE_CRN\", \"trusted_profile_id\": \"$TRUSTED_PROFILE_ID\"}]}"; then
        print_error "Failed to create the Sysdig Secure instance"
        abortScript
    fi
fi 
SYSDIG_INSTANCE_JSON="$(ibmcloud resource service-instance "$sysdig_name" -o json)"
SYSDIG_INSTANCE_CRN="$(echo "$SYSDIG_INSTANCE_JSON"|jq -r '.[0].crn')"
SYSDIG_INSTANCE_GUID="$(echo "$SYSDIG_INSTANCE_JSON"|jq -r '.[0].guid')"
SYSDIG_INSTANCE_REGION="$(echo "$SYSDIG_INSTANCE_JSON"|jq -r '.[0].region_id')"
print_msg "\nSysdig Secure instance details" 
echo "   crn:     '$SYSDIG_INSTANCE_CRN'"
echo "   guid:    '$SYSDIG_INSTANCE_GUID'"
echo "   region:  '$SYSDIG_INSTANCE_REGION'"

# Update the trusted profile and set the sysdig instance as identity 
if ! ibmcloud iam trusted-profile-identity $wlp_trusted_profile_name --id "$SYSDIG_INSTANCE_CRN" --id-type "crn" >/dev/null 2>&1; then
    print_msg "\nUpdating the IAM Trusted Profile '$wlp_trusted_profile_name' ..."
    ibmcloud iam trusted-profile-identity-create $wlp_trusted_profile_name \
        --id "$SYSDIG_INSTANCE_CRN" \
        --id-type "crn"
fi

#
# Setup Code Engine project
if ! does_instance_exist codeengine "$ceproject_name"; then 
    print_msg "\nCreating the Code Engine project '$ceproject_name' ..."
    if ! ibmcloud ce project create --name "$ceproject_name"; then 
        print_error "Code Engine project creation failed!"
        abortScript
    fi
else 
    print_msg "\nSelect the Code Engine project '$ceproject_name' ..."
    ibmcloud ce project select --name "$ceproject_name"
fi
CE_PROJECT_JSON="$(ibmcloud resource service-instance "$ceproject_name" -o json)"
CE_PROJECT_CRN="$(echo "$CE_PROJECT_JSON"|jq -r '.[0].crn')"
CE_PROJECT_GUID="$(echo "$CE_PROJECT_JSON"|jq -r '.[0].guid')"
print_msg "\nCode Engine project details" 
echo "   crn:   '$CE_PROJECT_CRN'"
echo "   guid:  '$CE_PROJECT_GUID'"

# Create the Trusted Profile
if ! ibmcloud iam trusted-profile $ce_trusted_profile_name >/dev/null 2>&1; then
    print_msg "\nCreating the IAM Trusted Profile '$ce_trusted_profile_name' ..."
    ibmcloud iam trusted-profile-create $ce_trusted_profile_name \
        --description "Trusted profile for Code Engine workload"

    # Add Code Engine compute resources as trusted entities
    ibmcloud iam trusted-profile-rule-create $ce_trusted_profile_name \
        --name code-engine-rule \
        --type Profile-CR \
        --cr-type CE \
        --conditions claim:project_name,operator:EQUALS,value:"$(ibmcloud ce proj current --output json|jq -r '.name')"

    # Grant the profile access to the Monitoring instance
    ibmcloud iam trusted-profile-policy-create $ce_trusted_profile_name \
        --roles Viewer,Reader \
        --service-name sysdig-secure \
        --service-instance $SYSDIG_INSTANCE_GUID
    
    ibmcloud iam trusted-profile-policy-create $ce_trusted_profile_name \
        --roles Viewer,Reader \
        --service-name codeengine \
        --service-instance $CE_PROJECT_GUID
fi
TRUSTED_PROFILE_JSON="$(ibmcloud iam trusted-profile "$ce_trusted_profile_name" -o json)"
TRUSTED_PROFILE_ID="$(echo "$TRUSTED_PROFILE_JSON"|jq -r '.[0].id')"
print_msg "\nTrusted Profile details" 
echo "   id: '$TRUSTED_PROFILE_ID'"

# Build and deploy app container
if ! ibmcloud ce app get --name sample-app >/dev/null 2>&1; then
    ibmcloud ce app create \
        --name sample-app \
        --src $SCRIPT_DIR/app/ \
        --cpu 0.5 \
        --memory 1G \
        --trusted-profiles-enabled \
        --env MONITORING_INSTANCE_GUID=$SYSDIG_INSTANCE_GUID \
        --env MONITORING_REGION=$SYSDIG_INSTANCE_REGION \
        --env TRUSTED_PROFILE_NAME=$ce_trusted_profile_name
else 
    ibmcloud ce app update \
        --name sample-app \
        --src $SCRIPT_DIR/app/ \
        --cpu 0.5 \
        --memory 1G \
        --trusted-profiles-enabled \
        --env MONITORING_INSTANCE_GUID=$SYSDIG_INSTANCE_GUID \
        --env MONITORING_REGION=$SYSDIG_INSTANCE_REGION \
        --env TRUSTED_PROFILE_NAME=$ce_trusted_profile_name
fi