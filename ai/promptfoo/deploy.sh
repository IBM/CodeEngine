#!/bin/bash

# ==============================
# ENVIRONMENT SETUP
# ==============================

REGION="${REGION:=eu-de}"
NAME_PREFIX="${NAME_PREFIX:=ce-promptfoo}"

# Generate a short uuid for some resources
uuid=$(uuidgen | tr '[:upper:]' '[:lower:]' | awk -F- '{print $1}')

ce_project_name=${PROJECT_NAME:-${NAME_PREFIX}-project}
resource_group_name=${NAME_PREFIX}-rg
cos_name="${NAME_PREFIX}--cos"
cos_key_name="${NAME_PREFIX}--cos-key"
cos_bucket_name_promptfoo_store="${NAME_PREFIX}-promptfoo-store-${uuid}"

# ==============================
# COMMON FUNCTIONS
# ==============================

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source "${SCRIPT_DIR}/../common.sh"

# Clean up previous run
function clean() {
    (
        ibmcloud ce project select --name ${ce_project_name} --quiet 2>/dev/null
        if [ $? == 0 ]; then
            ibmcloud ce project delete --name ${ce_project_name} --force --hard --no-wait 2>/dev/null
        fi

        ibmcloud resource service-key-delete ${cos_key_name} --force 2>/dev/null
        ibmcloud cos bucket-delete --bucket ${cos_bucket_name_promptfoo_store} --force 2>/dev/null
        ibmcloud resource service-instance-delete ${cos_name} -f -q 2>/dev/null

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
print_msg " Setting up \"Code Engine promptfoo\" sample"
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


#
# Creating COS instance and bucket
if ! does_instance_exist cloud-object-storage "$cos_name"; then
    print_msg "\nCreating COS instance '${cos_name}' ..."
    ibmcloud resource service-instance-create $cos_name cloud-object-storage standard global -d premium-global-deployment-iam
    if [ $? -ne 0 ]; then
        print_error "Cloud Object Storage creation failed!"
        abortScript
    fi
fi

COS_ID=$(ibmcloud resource service-instance $cos_name --output json | jq -r '.[0] | .id')
ibmcloud cos config crn --crn ${COS_ID} --force >/dev/null 2>&1
ibmcloud cos config auth --method IAM >/dev/null
ibmcloud cos config region --region $REGION >/dev/null
ibmcloud cos config endpoint-url --url s3.${REGION}.cloud-object-storage.appdomain.cloud >/dev/null

# Make sure all COS buckets do exist
res=$(has_bucket_name_with_prefix "${NAME_PREFIX}-promptfoo-store-")
if [[ "$res" == "" ]]; then
    print_msg "\nCreating COS bucket '${cos_bucket_name_promptfoo_store}' ..."
    ibmcloud cos bucket-create --bucket ${cos_bucket_name_promptfoo_store} --ibm-service-instance-id $COS_ID
else
    cos_bucket_name_promptfoo_store=$res
fi


# Create COS credentials
if ! does_serviceid_exist "${cos_key_name}"; then
    print_msg "\nCreating COS service key '${cos_key_name}' ..."
    ibmcloud resource service-key-create ${cos_key_name} --parameters '{"HMAC":true}' --instance-id $COS_ID
fi

print_msg "\nCOS instance '${COS_ID}' configured..."


print_msg "\nCreating a Code Engine Persistant Data Store 'promptfoo-cos-secret' to access the COS bucket as the task state store ..."
create_or_update=update
if ! ibmcloud ce secret get --name promptfoo-cos-secret >/dev/null 2>&1; then
    create_or_update="create --format hmac"
fi
ibmcloud ce secret $create_or_update --name promptfoo-cos-secret \
    --secret-access-key $(ibmcloud resource service-key ${cos_key_name} --output JSON | jq -r '.[0] | .credentials | .cos_hmac_keys | .secret_access_key') \
    --access-key-id $(ibmcloud resource service-key ${cos_key_name} --output JSON | jq -r '.[0] | .credentials | .cos_hmac_keys | .access_key_id')

if ! ibmcloud ce pds get --name promptfoo-store >/dev/null 2>&1; then
    ibmcloud ce pds create --name promptfoo-store \
        --cos-bucket-name ${cos_bucket_name_promptfoo_store} \
        --cos-bucket-location ${REGION} \
        --cos-access-secret promptfoo-cos-secret
fi

print_msg "\nDeploy the promptfoo application to Code Engine"
ibmcloud ce app create --name promptfoo --image ghcr.io/promptfoo/promptfoo:latest --cpu 4 --memory 8G -p 3000  --wait-timeout 600 --min-scale 1 --visibility public --mount-data-store /home/promptfoo/.promptfoo=promptfoo-store
while true; do
    ibmcloud ce app list
    not_ready_apps=$(ibmcloud ce app list | grep -e "promptfoo" | grep "Not Ready")
    if [  "$not_ready_apps" == "" ]; then
      break # all apps are ready
    fi
    print_msg "\nWaiting for all applications to be ready (sleep 15s)..."
    sleep 15
done

print_msg "\npromptfoo application is ready."

url=$(ibmcloud ce app get --name promptfoo -o json | jq -r '.status.url')
print_msg "\npromptfoo application is reachable under the following url:"
print_msg "$url"
print_msg "\nrun ./deploy.sh clean to remove all created resources"
print_success "\n=========================================="
print_success " SUCCESS"
print_success "==========================================\n"
