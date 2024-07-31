#!/bin/bash

set -euo pipefail

BASEDIR="$(dirname "$0")"

# Resources vars
BUILDER_JOB_NAME="builder-job"
M_SECRETS_NAME="mandatory-secrets"
ADAPTER="adapter-webhook"
GITHUB_SECRET="foobar"

# EN vars
EN_SUB=webhook-subscription
EN_DEST=webhook-destination
EN_TOPIC=webhook-topic
EN_SOURCE=webhook-adapter-source

# Mandatory variables provided by user for Adapter
IAM_API_KEY=${IAM_API_KEY:-unknown}
EN_INSTANCE_ID=${EN_INSTANCE_ID:-unknown}
CE_PROJECT_NAME=${CE_PROJECT_NAME:-unknown}
EN_REGION=${EN_REGION:=au-syd}
echo "[INFO] Please consider setting EN_REGION to your regional Event Notification endpoint, default is ${EN_REGION}"

# Mandatory variables provided by user for Build
USER_BUILD_NAME=${USER_BUILD_NAME:-unknown}

# clean removes created CE resources
function clean() {
  ibmcloud ce secret delete --name "${M_SECRETS_NAME}" -f --ignore-not-found
  ibmcloud ce app delete --name "${ADAPTER}" -f --ignore-not-found
  ibmcloud ce job delete --name "${BUILDER_JOB_NAME}" -f --ignore-not-found
}

if [ $# -ge 1 ] && [ -n "$1" ] && [ "$1" == "clean" ]
then
    echo "[INFO] going to clean existing project resources"
    clean
    exit 0
fi

if [ "$EN_INSTANCE_ID" == "unknown" ]; then
    echo "[ERROR] EN_INSTANCE_ID mandatory env var is not defined, this is the EN instance for handling github webhook events."
    exit 1
fi
if [ "$IAM_API_KEY" == "unknown" ]; then
    echo "[ERROR] IAM_API_KEY mandatory env var is not defined."
    exit 1
fi
if [ "$USER_BUILD_NAME" == "unknown" ]; then
    echo "[ERROR] USER_BUILD_NAME mandatory env var is not defined, this is the build to rebuild your images."
    exit 1
fi
if [ "$CE_PROJECT_NAME" == "unknown" ]; then
    echo "[ERROR] CE_PROJECT_NAME mandatory env var is not defined."
    exit 1
fi

############################### EN Artifacts Creation ###############################

#
# Note: Set IBMCLOUD_EN_ENDPOINT according to your region
#       if needed https://cloud.ibm.com/docs/event-notifications?topic=event-notifications-event-notifications-cli#en-cli-environment-variables
#


# setup the endpoints
export IBMCLOUD_EN_ENDPOINT="https://"$EN_REGION".event-notifications.cloud.ibm.com/event-notifications"


CE_PROJECT_CRN=$(ibmcloud resource service-instance $CE_PROJECT_NAME --location au-syd -q --output json | jq -r '.[].id')

echo "[INFO] Initializing Event Notifications instance ID ${EN_INSTANCE_ID}"
ibmcloud en init --instance-id=$EN_INSTANCE_ID

# Create destination for secrets manager topic and ce-app
EN_SOURCE_ID=$(ibmcloud en sources --instance-id $EN_INSTANCE_ID | grep $EN_SOURCE | awk '{print $6}' || echo "false")
if [[ $EN_SOURCE_ID == "false"  ]]; then
  echo "[INFO] Creating source ${EN_SOURCE}"
  EN_SOURCE_ID=$(ibmcloud en sources-create --instance-id $EN_INSTANCE_ID --name $EN_SOURCE --description foo --enabled true --output json | jq -r '.id')
else
  echo "[INFO] Found existing EN source ${EN_SOURCE_ID}"
fi

EN_TOPIC_ID=$(ibmcloud en topics --instance-id $EN_INSTANCE_ID | grep $EN_TOPIC | awk '{print $6}' || echo "false")
if [[ $EN_TOPIC_ID == "false"  ]]; then
  echo "[INFO] Creating topic ${EN_TOPIC}"
  EN_TOPIC_ID=$(ibmcloud en topic-create --instance-id $EN_INSTANCE_ID --name $EN_TOPIC --description foo --sources='[{"id":"'$EN_SOURCE_ID'","rules":[{"enabled":true,"event_type_filter": "$.*"}]}]' --output json | jq -r '.id')
else
  echo "[INFO] Found existing EN topic ${EN_TOPIC_ID}"
fi

EN_DESTINATION_ID=$(ibmcloud en destinations --instance-id $EN_INSTANCE_ID | grep $EN_DEST | awk '{print $6}' || echo "false")
if [[ $EN_DESTINATION_ID == "false"  ]]; then
  echo "[INFO] Creating destination ${EN_DEST}"
  EN_DESTINATION_ID=$(ibmcloud en destination-create --instance-id $EN_INSTANCE_ID --name $EN_DEST --type "ibmce" --config '{"params": {"type":"job","project_crn":"'$CE_PROJECT_CRN'", "job_name": "'$BUILDER_JOB_NAME'"}}' --output json | jq -r '.id')
else
  echo "[INFO] Found existing EN destination ${EN_DESTINATION_ID}"
fi

EN_SUB_ID=$(ibmcloud en subscriptions --instance-id $EN_INSTANCE_ID | grep $EN_SUB | awk '{print $7}' || echo "false")
if [[ $EN_SUB_ID == "false"  ]]; then
  echo "[INFO] Creating subscription ${EN_SUB}"
  ibmcloud en subscription-create --name $EN_SUB --topic-id $EN_TOPIC_ID  --destination-id $EN_DESTINATION_ID --instance-id $EN_INSTANCE_ID
else
  echo "[INFO] Found existing EN subscription ${EN_SUB_ID}"
fi

############################### CE Artifacts Creation ###############################

echo "[INFO] Going to create secret ${M_SECRETS_NAME}"
ibmcloud ce secret create --name "${M_SECRETS_NAME}" \
    --from-literal IAM_API_KEY="${IAM_API_KEY}" --from-literal GITHUB_SECRET="${GITHUB_SECRET}" \
    --from-literal EN_SOURCE_ID="${EN_SOURCE_ID}" --from-literal EN_INSTANCE_ID="${EN_INSTANCE_ID}"

echo "[INFO] Going to build and deploy adapter"
echo "[INFO] Going to create Application ${ADAPTER} from source"
ibmcloud ce app create --name "${ADAPTER}" --build-source "${BASEDIR}" --build-dockerfile "${BASEDIR}"/Dockerfile.adapter --env-from-secret $M_SECRETS_NAME --wait


echo "[INFO] Going to build and deploy builder"
echo "[INFO] Going to create Builder ${BUILDER_JOB_NAME} from source"
ibmcloud ce job create --name "${BUILDER_JOB_NAME}" --build-source "${BASEDIR}" --build-dockerfile "${BASEDIR}"/Dockerfile.builder --env BUILD_NAME="${USER_BUILD_NAME}" --wait


