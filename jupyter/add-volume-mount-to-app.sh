#!/usr/bin/env bash
#*******************************************************************************
# Licensed Materials - Property of IBM
# IBM Cloud Code Engine, 5900-AB0
# © Copyright IBM Corp. 2024
# US Government Users Restricted Rights - Use, duplication or
# disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
#*******************************************************************************

# Script to help setting up the volume mount for apps.

# NOTE: The user must select the Code Engine project before running this script. 
# Usage: add-volume-mount-to-app.sh CE_APP_NAME MOUNT_NAME MOUNT_PATH

# Check whether all required input params are set
if [[ -z "$1" || -z "$2" || -z "$3" || -z "$4" ]]
  then
    echo "One or more arguments are missing"
    echo "Usage: add-volume-mount-to-app.sh CE_APP_NAME MOUNT_NAME MOUNT_PATH COS_SUBPATH"
    exit 1
fi

set -euo pipefail

# Obtain the input parameters
CE_APP_NAME=$1
MOUNT_NAME=$2
MOUNT_PATH=$3
COS_SUBPATH=$4
NEW_REVISION_NAME=${CE_APP_NAME}-$(openssl rand -hex 6)


echo "CE_APP_NAME: '$CE_APP_NAME'"
echo "CE_MOUNT_NAME: '$MOUNT_NAME'"
echo "CE_MOUNT_PATH: '$MOUNT_PATH'"
echo "COS_SUBPATH: '$COS_SUBPATH'"
echo ""

VOLUME_NAME=$2

# Create the JSON patch

PATCH='[
 {
    "op": "replace",
    "path": "/spec/template/metadata/name",
    "value": "'$NEW_REVISION_NAME'"
  },
  {
    "op": "add",
    "path": "/spec/template/spec/volumes",
    "value": [
      {"name": "'$VOLUME_NAME'", "persistentVolumeClaim": {"claimName": "'$MOUNT_NAME'"}}
    ]
  },
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/volumeMounts",
    "value": [{
      "name": "'$VOLUME_NAME'", "mountPath": "'$MOUNT_PATH'", "subPath": "'$COS_SUBPATH/work'"
    }]
  }
]'

# Apply the patch
kubectl patch ksvc  "$CE_APP_NAME" --type='json' --patch "$PATCH" 2> /dev/null

echo "Patched app '$CE_APP_NAME' with volume '$VOLUME_NAME' mounted at '$MOUNT_PATH' with new revision '$NEW_REVISION_NAME'"