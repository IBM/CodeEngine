#!/bin/bash

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
    echo -e ""
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

# ==============================
# COMMON IBMCLOUD HELPERS
# ==============================

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