#!/bin/bash

# © Copyright IBM Corporation 2020
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

BASEDIR="$(dirname "$0")"

OBSERVER_APP_NAME="ce-mq-observer"
OBSERVER_SECRETS_NAME="observer-secrets"
OBSERVER_CONFIG_NAME="observer-config"

CONSUMER_JOB_NAME="ce-mq-consumer"
CONSUMER_SECRETS_NAME="consumer-secrets"

COS_KEY_SETTING=""
RESOURCES_DIR="observer/resources"
SEED_REGISTRATION_DATA=seeddata

function check() { 
    echo "Checking envrionment variables"
    is_good=1
    if [ -z "${ADMIN_USER}" ]; then
        echo "[ERROR] ADMIN_USER for MQ mandatory env var is not defined."
        is_good=0
    fi

    if [ -z "${ADMIN_PASSWORD}" ]; then
        echo "[ERROR] ADMIN_PASSWORD for MQ mandatory env var is not defined."
        is_good=0
    fi

    if [ -z "${APP_USER}" ]; then
        echo "[ERROR] APP_USER for MQ mandatory env var is not defined."
        is_good=0
    fi

    if [ -z "${APP_PASSWORD}" ]; then
        echo "[ERROR] APP_PASSWORD for MQ mandatory env var is not defined."
        is_good=0
    fi

    if [ -z "${ce_apikey}" ]; then
        echo "[ERROR] ce_apikey mandatory for Code Engine env var is not defined."
        is_good=0
    fi

    if [ $is_good -eq 0 ]; then
        exit
    fi

    if [ ! -z "${cos_apikey}" ]; then
        COS_KEY_SETTING="--from-literal cos_apikey=${cos_apikey}"
    fi

    echo "COS Setting is ${COS_KEY_SETTING}"
}      

function clean() {
    echo "Cleaning previous deployment, if any"
    ibmcloud ce secret delete --name "${OBSERVER_SECRETS_NAME}" -f --ignore-not-found
    ibmcloud ce configmap delete --name "${OBSERVER_CONFIG_NAME}" -f --ignore-not-found
    ibmcloud ce app delete --name "${OBSERVER_APP_NAME}" -f --ignore-not-found

    ibmcloud ce secret delete --name "${CONSUMER_SECRETS_NAME}" -f --ignore-not-found
    ibmcloud ce job delete --name "${CONSUMER_JOB_NAME}" -f --ignore-not-found
}

function createconfig() {
    echo "Creating deployment assets"

    echo "Creating secret ${OBSERVER_SECRETS_NAME}"
    ibmcloud ce secret create --name "${OBSERVER_SECRETS_NAME}" \
        --from-literal ADMIN_USER="${ADMIN_USER}" \
        --from-literal ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
        --from-literal ce_apikey="${ce_apikey}" \
        ${COS_KEY_SETTING}

    echo "Creating configmap ${OBSERVER_CONFIG_NAME}"
    ibmcloud ce configmap create --name "${OBSERVER_CONFIG_NAME}" --from-file "${BASEDIR}/${RESOURCES_DIR}/${SEED_REGISTRATION_DATA}"

    echo "Creating secret ${CONSUMER_SECRETS_NAME}"
    ibmcloud ce secret create --name "${CONSUMER_SECRETS_NAME}" \
        --from-literal APP_USER="${APP_USER}" \
        --from-literal APP_PASSWORD="${APP_PASSWORD}" 
}

function createapp() {
    echo "Creating observer application ${OBSERVER_APP_NAME}"
    ibmcloud ce app create --name "${OBSERVER_APP_NAME}" \
        --build-source "${BASEDIR}" \
        --build-dockerfile "${BASEDIR}/Dockerfile" \
        --env-from-secret $OBSERVER_SECRETS_NAME \
        --env-from-configmap $OBSERVER_CONFIG_NAME \
        --min-scale=1 --max-scale=1 --wait
}

function createjobdefinition() {
    echo "Creating observer application ${CONSUMER_JOB_NAME}"
    ibmcloud ce job create --name "${CONSUMER_JOB_NAME}" \
        --build-source "${BASEDIR}" \
        --build-dockerfile "${BASEDIR}/Dockerfile.consumer" \
        --env-from-secret $CONSUMER_SECRETS_NAME 
}


echo "Starting deployment of IBM MQ Observer to Code Engine"
clean
if [ $# -ge 1 ] && [ -n "$1" ] && [ "$1" == "clean" ]
then
    echo "Exiting as only clean selected"
    exit 0
fi

check
createconfig
createjobdefinition
createapp

echo "Deployment completed"
