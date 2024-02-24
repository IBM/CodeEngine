#!/bin/bash

set -euo pipefail

BASEDIR="$(dirname "$0")"

# Required variables
CM_TOPICJOBS_NAME="topic-to-jobs"
AUTH_SECRETS_NAME="authentication-secrets"
CONSUMER_JOB_NAME_1="payments-consumer"
CONSUMER_JOB_NAME_2="shipping-consumer" #TODO: this cannot be static, optimize it
OBSERVER_JOB_NAME="ce-kafka-observer"
OBSERVER_JR_NAME="kafka-observer"
IAM_API_KEY=foobar
BROKERS=foobar
KAFKA_USER=foobar
KAFKA_TOKEN=foobar
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

# trim all quotes
BROKERS=$(echo $BROKERS | tr -d '"')

# Create CE Resources
echo "[INFO] Going to create secret ${AUTH_SECRETS_NAME}"

ibmcloud ce secret create --name $AUTH_SECRETS_NAME \
    --from-literal KAFKA_TOKEN=$KAFKA_TOKEN \
    --from-literal KAFKA_USER=$KAFKA_USER \
    --from-literal IAM_API_KEY=$IAM_API_KEY

echo "[INFO] Going to create configmap ${CM_TOPICJOBS_NAME}"
# kubectl apply -f ${BASEDIR}/resources/configmap.yaml # TODO: Use ibmcloud ce
ibmcloud ce configmap create --name $CM_TOPICJOBS_NAME --from-file ${BASEDIR}/resources/kafkadata

echo "[INFO] Going to create JobDefinition ${CONSUMER_JOB_NAME_1}"
ibmcloud ce job create --name $CONSUMER_JOB_NAME_1 --mode daemon --build-source ${BASEDIR} --build-dockerfile ${BASEDIR}/Dockerfile.consumer --env BROKERS="${BROKERS}" --env-from-secret $AUTH_SECRETS_NAME --env-from-configmap $CM_TOPICJOBS_NAME --env CONSUMER_GROUP=payment-consumer-group --wait

echo "[INFO] Going to create JobDefinition ${CONSUMER_JOB_NAME_2}"
ibmcloud ce job create --name $CONSUMER_JOB_NAME_2 --mode daemon --build-source ${BASEDIR} --build-dockerfile ${BASEDIR}/Dockerfile.consumer --env BROKERS="${BROKERS}" --env-from-secret $AUTH_SECRETS_NAME --env-from-configmap $CM_TOPICJOBS_NAME --env CONSUMER_GROUP=shipping-consumer-group --wait

echo "[INFO] Going to create JobDefinition ${OBSERVER_JOB_NAME}"
ibmcloud ce job create --name $OBSERVER_JOB_NAME --mode daemon --build-source ${BASEDIR} --build-dockerfile ${BASEDIR}/Dockerfile.observer --env BROKERS="${BROKERS}" --env-from-secret $AUTH_SECRETS_NAME --env-from-configmap $CM_TOPICJOBS_NAME --wait

echo "[INFO] Submitting Job ${OBSERVER_JOB_NAME}"
ibmcloud ce jobrun submit --job $OBSERVER_JOB_NAME --name $OBSERVER_JR_NAME
