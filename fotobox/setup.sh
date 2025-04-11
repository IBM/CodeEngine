#!/bin/bash

echo "create upload-function and download-application in code engine"

ibmcloud target -g Default

ibmcloud ce project select -n codeengine-fotobox-project # name of the project that was setup in terraform script

function_url=$(ibmcloud ce fn create --name fotobox-cos-upload  --runtime python  --build-source upload-function --env-from-configmap fotobox-config --env-from-secret fotobox-secret -o jsonpath={.endpoint})

app_url=$(ibmcloud ce app create --name fotobox-get-pics --build-dockerfile Dockerfile  --build-source download-app --env-from-configmap fotobox-config --env-from-secret fotobox-secret -o jsonpath={.status.url})

echo "import { writable } from 'svelte/store';

// Create a writable store
export const toggelGridTimer = writable(false);
export const toggleDownload = writable(false)

export const uploadURL = \"$function_url\"
export const downloadURL = \"$app_url\"
" > ./frontend-app/src/stores.js

ibmcloud ce app create --name fotobox-frontend --build-dockerfile Dockerfile  --build-source frontend-app



