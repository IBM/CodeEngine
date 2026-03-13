#!/bin/bash

# ==============================
# ENVIRONMENT SETUP
# ==============================

source .env

REGION="${REGION:=eu-de}"
NAME_PREFIX="${NAME_PREFIX:=ce-langchain-agent}"

ce_project_name=${PROJECT_NAME:-${NAME_PREFIX}-project}
resource_group_name=${NAME_PREFIX}-rg

# ==============================
# COMMON FUNCTIONS
# ==============================

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source "${SCRIPT_DIR}/../common.sh"

# Clean up previous run
function clean() {
    (
        target_resource_group $resource_group_name

        ibmcloud ce project select --name ${ce_project_name} --quiet 2>/dev/null
        if [ $? == 0 ]; then
            ibmcloud ce project delete --name ${ce_project_name} --force --hard --no-wait 2>/dev/null
        fi

        ibmcloud resource group $resource_group_name --quiet 2>/dev/null
        if [[ $? == 0 ]]; then
            COUNTER=0
            # some resources (e.g. boot volumes) are deleted with some delay. Hence, the script waits before exiting with an error
            while (( "$(ibmcloud resource service-instances --type all -g $resource_group_name --location $REGION --output json | jq -r '. | length')" > 0 )); do
                sleep 5
                COUNTER=$((COUNTER + 1))
                if ((COUNTER > 3)); then
                    print_error "Cleanup failed! Please make sure to delete remaining resources manually to avoid unwanted charges."
                    ibmcloud resource service-instances --type all -g $resource_group_name --location $REGION
                    exit 1
                fi
            done
        fi

	ibmcloud resource group-delete $resource_group_name --force 2>/dev/null
    )
}

if [[ "$1" == "clean" ]]; then
    print_msg "\nCleaning up the created IBM Cloud resources ..."
    clean
    print_success "\n==========================================\n DONE\n==========================================\n"
    exit 0
fi

# ==============================
# MAIN SCRIPT FLOW
# ==============================

# Ensure that latest versions of used IBM Cloud ClI is installed
print_msg "\nPulling latest IBM Cloud CLI release ..."
ibmcloud update --force

# Ensure that latest versions of used IBM Cloud CLI plugins are installed
print_msg "\nInstalling required IBM Cloud CLI plugins ..."
ensure_plugin_is_up_to_date code-engine

print_msg "\n======================================================"
print_msg " Setting up \"LangChain Skills Agent\" sample"
print_msg "======================================================\n"

target_region $REGION

#
# Create the resource group, if it does not exist
ibmcloud resource group $resource_group_name --quiet
if [ $? != 0 ]; then
    print_msg "\nCreating resource group '$resource_group_name' ..."
    ibmcloud resource group-create $resource_group_name
fi
target_resource_group $resource_group_name

if ! does_instance_exist codeengine "$ce_project_name"; then
    print_msg "\nCreating the Code Engine project '$ce_project_name' ..."
    ibmcloud ce project create --name $ce_project_name
    if [ $? -ne 0 ]; then
        print_error "Code Engine project creation failed!"
        abortScript
    fi
else
    print_msg "\nSelecting the Code Engine project '$ce_project_name' ..."
    ibmcloud ce project select --name $ce_project_name
fi
project_guid=$(ibmcloud ce project get --name $ce_project_name --output json | jq -r '.guid')

print_msg "\nCreating code engine secret for the agent with parameters from .env file"
ibmcloud ce secret create --name langchain-agent-secret --from-literal INFERENCE_BASE_URL="$INFERENCE_BASE_URL" \
--from-literal INFERENCE_API_KEY="$INFERENCE_API_KEY" \
--from-literal INFERENCE_MODEL_NAME="$INFERENCE_MODEL_NAME" \
--from-literal INFERENCE_PROJECT_ID="$INFERENCE_PROJECT_ID" \
--from-literal OPENWEATHER_API_KEY="$OPENWEATHER_API_KEY" \
--from-literal EXCHANGE_RATE_API_KEY="$EXCHANGE_RATE_API_KEY"

print_msg "\nCreating the LangChain agent as a code engine application"
ibmcloud ce app create --name langchain-agent --env-from-secret langchain-agent-secret --build-source ./src --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility public

while true; do
    ibmcloud ce app list
    not_ready_apps=$(ibmcloud ce app list | grep -e "langchain-agent" | grep "Not Ready")
    if [  "$not_ready_apps" == "" ]; then
      break # all apps are ready
    fi
    print_msg "\nWaiting for all applications to be ready (sleep 15s)..."
    sleep 15
done

print_msg "\n"
print_msg "\nLangChain agent application is ready."
print_msg "\n"

url=$(ibmcloud ce app get --name langchain-agent -o json | jq -r '.status.url')
print_msg "\nAgent is reachable under the following url:"
echo $url

print_msg "\n"
print_msg "\nList the agents:"
curl -s -X GET $url/agents | jq

print_msg "\n"
print_msg "\nGet agent info (including loaded skills):"
curl -s -X GET $url/info | jq

print_msg "\n"
print_msg "\nCalling the agent with an example query"
cat payload/payload.json | jq

curl -s -X POST $url/runs -H "Content-Type: application/json" -d @payload/payload.json | jq

print_success "\n=========================================="
print_success " SUCCESS"
print_success "==========================================\n"
print_msg "\n"
print_msg "\nrun ./deploy.sh clean to remove all created resources"

# Made with Bob
