#!/bin/bash

set -euo pipefail

BASEDIR="$(dirname "$0")"

CE_APP="ce-app"
CE_SECRET="cert"
CE_EN_SECRET="ce-en-secret"
EN_INSTANCE="en-instance"
EN_SOURCE_1="en-rotate-cert-source"
EN_SOURCE_2="en-ce-source"
EN_TOPIC_1="en-rotate-cert-topic"
EN_TOPIC_2="en-ce-topic"
EN_DEST_1="en-rotate-cert-destination"
EN_DEST_2="en-ce-destination"
EN_SUB_1="en-rotate-cert-sub"
EN_SUB_2="en-ce-sub"
SM_INSTANCE="sm-instance"
SM_SECRET="cert"
API_KEY="<>"

CE_REGION="${CE_REGION:=au-syd}"
SM_REGION="${SM_REGION:=au-syd}"
EN_REGION="${EN_REGION:=au-syd}"


function validatePlugins() {
 DESIRED_PLUGINS=$(ibmcloud plugin list | grep "secrets-manager\|event-notifications\|code-engine" | wc -l | tr -d '[:space:]')
 if [ $DESIRED_PLUGINS != "3" ]; then
    echo -e "[ERROR] Missing plugins, please ensure the following plugins are installed: "
    echo "[ERROR] ibmcloud plugin install code-engine"
    echo "[ERROR] ibmcloud plugin install en@0.2.0"
    echo "[ERROR] ibmcloud plugin install secrets-manager"
    exit 1
 fi
}

if ! hash jq >/dev/null 2>&1; then
  echo "[ERROR] jq is not installed, bailing out."
  echo
  exit 1
fi

function clean() {
  ibmcloud ce app delete -n $CE_APP -f --ignore-not-found >/dev/null 2>&1
  ibmcloud ce secret delete -n $CE_SECRET -f --ignore-not-found >/dev/null 2>&1
  ibmcloud ce secret delete -n $CE_EN_SECRET -f --ignore-not-found >/dev/null 2>&1
  ibmcloud ce secret delete -n $CE_SECRET -f --ignore-not-found >/dev/null 2>&1
}

function validateInstanceState() {
  NAME=$1
  START_TIME=$(date +%s)
  TIMEOUT=900
  echo "[INFO] waiting for service-instance ${NAME} to become active"
  while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED_TIME=$((CURRENT_TIME - START_TIME))
    STATE=$(ibmcloud resource service-instance ${NAME} -q --output json | jq -r '.[].state')
    if [ $STATE == "active" ]; then
        echo "[INFO] service-instance ${NAME} is active"
        break
    fi

    if [ ${ELAPSED_TIME} -ge ${TIMEOUT} ]; then
      echo "[ERROR] timeout reached waiting for service-instance ${NAME} to be ready"
      exit 1
    fi
    sleep 1
  done
}


validatePlugins

if [ $# -ge 1 ] && [ -n "$1" ]
then
    echo "[INFO] going to clean existing project resources"
    clean
    exit 0
fi

# Create an instance of Event Notifications and Secrets Manager
if ! ibmcloud resource service-instances --location $EN_REGION -q | grep $EN_INSTANCE >/dev/null 2>&1; then
 echo "[INFO] Going to create event-notifications ${EN_INSTANCE} instance in ${EN_REGION}"
 ibmcloud resource service-instance-create $EN_INSTANCE event-notifications lite $EN_REGION
fi

if ! ibmcloud resource service-instances --location $SM_REGION -q | grep $SM_INSTANCE >/dev/null 2>&1; then
 echo "[INFO] Going to create secrets-manager ${SM_INSTANCE} instance in ${SM_REGION}"
 ibmcloud resource service-instance-create $SM_INSTANCE secrets-manager trial $SM_REGION
fi

# Wait for the service instances to be ready
echo "[INFO] Waiting for Event Notifications and Secrets Manager Instances to become available"
validateInstanceState $EN_INSTANCE
validateInstanceState $SM_INSTANCE

# Retrieve respective ID's, GUID's
CE_PROJECT_ID=$(ibmcloud ce project current --output json | jq -r '.guid')
EN_INSTANCE_ID=$(ibmcloud resource service-instance $EN_INSTANCE --location $EN_REGION -q --output json | jq -r '.[].guid')
EN_CRN_ID=$(ibmcloud resource service-instance $EN_INSTANCE --location $EN_REGION -q --output json | jq -r '.[].id')
SM_INSTANCE_ID=$(ibmcloud resource service-instance $SM_INSTANCE --location $SM_REGION -q --output json | jq -r '.[].guid')
SM_CRN_ID=$(ibmcloud resource service-instance $SM_INSTANCE --location $SM_REGION -q --output json | jq -r '.[].id')

# setup the endpoints
export SECRETS_MANAGER_URL="https://"$SM_INSTANCE_ID"."$SM_REGION".secrets-manager.appdomain.cloud"
export IBMCLOUD_EN_ENDPOINT="https://"$EN_REGION".event-notifications.cloud.ibm.com/event-notifications"

CERTDIR="$(mktemp -d)"
trap 'rm -rf -- "$CERTDIR"' EXIT
export CERTDIR

echo "[INFO] Generating key and certificates via openssl"
openssl genrsa -out $CERTDIR/test-key.key 2048 >/dev/null 2>&1
openssl req -new -x509 -key $CERTDIR/test-key.key -out $CERTDIR/test-cert.pem -days 90 -subj "/C=GB/ST=London/L=London/O=Global Security/OU=IT Department/CN=example.com" >/dev/null 2>&1
openssl req -new -x509 -key $CERTDIR/test-key.key -out $CERTDIR/new-test-cert.pem -days 90 -subj "/C=GB/ST=London/L=London/O=Global Security/OU=IT Department/CN=example.com" >/dev/null 2>&1


certificate=$(sed 's/$/\\n/' ${CERTDIR}/test-cert.pem | tr -d '\n')
new_certificate=$(sed 's/$/\\n/' ${CERTDIR}/new-test-cert.pem | tr -d '\n')
private_key=$(sed 's/$/\\n/' ${CERTDIR}/test-key.key | tr -d '\n')


echo "[INFO] Creating secret $SM_SECRET in the secrets manager"
SM_SECRET_ID=$(ibmcloud secrets-manager secret-create \
    --secret-prototype="{\"name\": \"$SM_SECRET\", \"secret_type\": \"imported_cert\", \"certificate\": \"$certificate\", \"private_key\":\"$private_key\"}" --quiet --output json \
    | jq -r '.id')

POLICY_EXISTS=$(ibmcloud iam authorization-policies --output json | jq -r --arg ENINSTANCEID "$EN_INSTANCE_ID" '.[] | .resources[0].attributes[] | select( .name == "serviceInstance" and .value==$ENINSTANCEID ) | select (.!=null)')
if [[ -z $POLICY_EXISTS ]]; then
  echo "[INFO] Creating iam authorization policy for SM and EN service"
  ibmcloud iam authorization-policy-create secrets-manager event-notifications "Event Source Manager" --source-service-instance-id $SM_INSTANCE_ID --target-service-instance-id $EN_INSTANCE_ID --quiet 
else
  echo "[INFO] Found iam authorization policy for SM and EN service"
fi

EN_CRN_ID_CHECK=$(ibmcloud secrets-manager notifications-registration -q --output json | jq -r '.event_notifications_instance_crn' || echo "false")
if [[ "${EN_CRN_ID_CHECK}" != "${EN_CRN_ID}" ]]; then
 echo "[INFO] Creating notifications-registration-create in the secrets manager"
 ibmcloud secrets-manager notifications-registration-create \
    --event-notifications-instance-crn ${EN_CRN_ID} \
    --event-notifications-source-name $EN_SOURCE_1 \
    --region $SM_REGION \
    --instance-id $SM_INSTANCE_ID \
    -q
else
  echo "[INFO] Found notifications-registration in the secrets manager"
fi

echo "[INFO] Initializing Event Notifications instance ID ${EN_INSTANCE_ID}"
ibmcloud en init --instance-id=$EN_INSTANCE_ID

EN_TOPIC_ID_1=$(ibmcloud en topic list --instance-id $EN_INSTANCE_ID  | grep "${EN_TOPIC_1}" | awk '{print $8}' || echo "false")
if [[ $EN_TOPIC_ID_1 == "false"  ]]; then
  echo "[INFO] Creating ${EN_TOPIC_1} topic for EN instance-id ${EN_INSTANCE_ID}"
  EN_TOPIC_ID_1=$(ibmcloud en topic create --instance-id=$EN_INSTANCE_ID \
      --name=$EN_TOPIC_1 \
      --description="This is a topic" \
      --sources="[{\"id\" : \"$SM_CRN_ID\", \"rules\" : [{\"enabled\" : true, \"event_type_filter\" : \"$.type == 'com.ibm.cloud.secrets-manager.secret_rotated'\", \"notification_filter\": \"$.data.secrets[0].secret_name == '$SM_SECRET'\"}]}]" | awk '/id/{ print $2 }')
else
  echo "[INFO] Found existing topic ${EN_TOPIC_ID_1}"
fi

echo "[INFO] Creating ${CE_EN_SECRET} in CE project with iam api-key"
ibmcloud ce secret create --name $CE_EN_SECRET --from-literal IAM_API_KEY=$API_KEY --quiet

echo "[INFO] Creating ${CE_SECRET} in CE project with tls cert"

ibmcloud ce secret create --name $CE_SECRET --quiet --format tls \
    --cert-chain-file ${CERTDIR}/test-cert.pem --private-key-file ${CERTDIR}/test-key.key

# Create the app using the ce app create command from local source code
echo "[INFO] Creating CE application ${CE_APP}"
ibmcloud ce application create --name $CE_APP \
    --build-strategy=buildpacks --build-source . \
    -e CE_PROJECT_ID=$CE_PROJECT_ID -e CE_REGION=$CE_REGION \
    -e EN_REGION=$EN_REGION -e SM_ENDPOINT=$SECRETS_MANAGER_URL \
    --env-from-secret $CE_EN_SECRET

# get the url of the app
echo "[INFO] Retrieving CE App ${CE_APP} endpoint:"
CE_APP_URL=$(ibmcloud ce app get -n $CE_APP -o url)
echo "[INFO] ${CE_APP_URL}"

# Create destination for secrets manager topic and ce-app
EN_DESTINATION_ID_1=$(ibmcloud en destination list | grep en-rotate-cert-destination | awk '{print $4}' || echo "false")
if [[ $EN_DESTINATION_ID_1 == "false"  ]]; then
  echo "[INFO] Creating destination for secrets manager topic and CE Application"
  EN_DESTINATION_ID_1=$(ibmcloud en destination create \
      --instance-id=$EN_INSTANCE_ID \
      --name=$EN_DEST_1 \
      --type="ibmce" \
      --config='{"params": {"url":"'$CE_APP_URL'", "verb": "post", "custom_headers": {}, "sensitive_headers": ["exampleString"]}}' | awk '/id/{ print $2 }')
else
  echo "[INFO] Found existing EN destination ${EN_DEST_1}"
fi

SUBSCRIPTIONOUTPUT=$(ibmcloud en subscription list | grep "${EN_SUB_1}" || echo "false")
if [[ $SUBSCRIPTIONOUTPUT == "false"  ]]; then
  echo "[INFO] Creating subscription ${EN_SUB_1}"
  ibmcloud en subscription create \
      --name=$EN_SUB_1 \
      --destination-id=$EN_DESTINATION_ID_1 \
      --topic-id=$EN_TOPIC_ID_1 \
      --instance-id=$EN_INSTANCE_ID
else
  echo "[INFO] Found existing subscription ${EN_SUB_1}"
fi

echo "[INFO] Rotating the Secret $SM_SECRET in Secrets Manager"
ibmcloud secrets-manager secret-version-create \
    --secret-id=$SM_SECRET_ID \
    --secret-version-prototype="{\"certificate\": \"${new_certificate}\", \"private_key\": \"${private_key}\", \"custom_metadata\": {\"anyKey\": \"anyValue\"}, \"version_custom_metadata\": {\"anyKey\": \"anyValue\"}}"

echo "[INFO] Waiting for 100 seconds"
sleep 100

echo "[INFO] Getting logs of the app"
ibmcloud ce app logs --n $CE_APP