#!/bin/sh

BUILD_NAME=example-script-build-cos2cos-${IMAGE_NAME}

ibmcloud target -r ${CR_REGION} -g ${RESOURCE_GROUP}
ibmcloud ce project list
ibmcloud ce project select -n "${PROJECT_NAME}"

ibmcloud ce build create --name ${BUILD_NAME} --build-type local --image ${REGISTRY}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}
ibmcloud ce buildrun submit --build ${BUILD_NAME} --name ${BUILD_NAME}-build-run