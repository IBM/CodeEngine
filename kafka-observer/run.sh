#!/bin/bash

set -euo pipefail

BASEDIR="$(dirname "$0")"

# Resources vars
CM_TOPICJOBS_NAME="topic-to-jobs"
AUTH_SECRETS_NAME="authentication-secrets"

# Consumers vars
CONSUMER_JOB_NAME_1="payments-consumer"
CONSUMER_JOB_NAME_2="shipping-consumer"

# Observer vars
OBSERVER_JOB_NAME="ce-kafka-observer"
OBSERVER_JR_NAME="kafka-observer"

# Mandatory variables provided by user
IAM_API_KEY=${IAM_API_KEY:-foobar}
ES_SERVICE_INSTANCE=${ES_SERVICE_INSTANCE:-foobar}

if [ "$IAM_API_KEY" == "foobar" ]; then
    echo "[ERROR] IAM_API_KEY mandatory env var is not defined."
    exit 1
fi

if [ "$ES_SERVICE_INSTANCE" == "foobar" ]; then
    echo "[ERROR] ES_SERVICE_INSTANCE mandatory env var is not defined."
    exit 1
fi

# Verify that the ES service instance exists under the same account
if ! ibmcloud resource service-instance $ES_SERVICE_INSTANCE -q > /dev/null 2>&1; then
    echo "[ERROR] $ES_SERVICE_INSTANCE service instance does not exists, please ensure the ES instance is created"
    exit 1
fi

# clean removes created CE resources
function clean() {
  ibmcloud ce configmap delete --name $CM_TOPICJOBS_NAME -f --ignore-not-found
  ibmcloud ce secret delete --name $AUTH_SECRETS_NAME -f --ignore-not-found
  ibmcloud ce job delete --name $CONSUMER_JOB_NAME_1 -f --ignore-not-found
  ibmcloud ce job delete --name $CONSUMER_JOB_NAME_2 -f --ignore-not-found
  ibmcloud ce job delete --name $OBSERVER_JOB_NAME -f --ignore-not-found
  ibmcloud ce jobrun delete --name $OBSERVER_JR_NAME -f --ignore-not-found
}

if [ $# -ge 1 ] && [ -n "$1" ] && [ "$1" == "clean" ]
then
    echo "[INFO] going to clean existing project resources"
    clean
    exit 0
fi

# Create CE Resources
echo "[INFO] Going to create secret ${AUTH_SECRETS_NAME}"

ibmcloud ce secret create --name $AUTH_SECRETS_NAME --from-literal IAM_API_KEY=$IAM_API_KEY

echo "[INFO] Going to create configmap ${CM_TOPICJOBS_NAME}"
ibmcloud ce configmap create --name $CM_TOPICJOBS_NAME --from-file ${BASEDIR}/resources/kafkadata

echo "[INFO] Going to create JobDefinition ${CONSUMER_JOB_NAME_1}"
ibmcloud ce job create --name $CONSUMER_JOB_NAME_1 --mode daemon --build-source ${BASEDIR} --build-dockerfile ${BASEDIR}/Dockerfile.consumer --env-from-secret $AUTH_SECRETS_NAME --env-from-configmap $CM_TOPICJOBS_NAME --env CONSUMER_GROUP=payment-consumer-group --env CE_REMOVE_COMPLETED_JOBS=IMMEDIATELY --wait

echo "[INFO] Going to create JobDefinition ${CONSUMER_JOB_NAME_2}"
ibmcloud ce job create --name $CONSUMER_JOB_NAME_2 --mode daemon --build-source ${BASEDIR} --build-dockerfile ${BASEDIR}/Dockerfile.consumer --env-from-secret $AUTH_SECRETS_NAME --env-from-configmap $CM_TOPICJOBS_NAME --env CONSUMER_GROUP=shipping-consumer-group --env CE_REMOVE_COMPLETED_JOBS=IMMEDIATELY --wait

echo "[INFO] Going to create JobDefinition ${OBSERVER_JOB_NAME}"
ibmcloud ce job create --name $OBSERVER_JOB_NAME --mode daemon --build-source ${BASEDIR} --build-dockerfile ${BASEDIR}/Dockerfile.observer --env-from-secret $AUTH_SECRETS_NAME --env-from-configmap $CM_TOPICJOBS_NAME --wait

echo "[INFO] Going to bind all JobDefinitions to the provided Event Streams service instance"
ibmcloud ce job bind --name $CONSUMER_JOB_NAME_1 --service-instance $ES_SERVICE_INSTANCE
ibmcloud ce job bind --name $CONSUMER_JOB_NAME_2 --service-instance $ES_SERVICE_INSTANCE
ibmcloud ce job bind --name $OBSERVER_JOB_NAME --service-instance $ES_SERVICE_INSTANCE

echo "[INFO] Submitting Job ${OBSERVER_JOB_NAME}"
ibmcloud ce jobrun submit --job $OBSERVER_JOB_NAME --name $OBSERVER_JR_NAME
