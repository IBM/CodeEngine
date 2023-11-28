#!/bin/bash

set -euo pipefail

SERVER_APP_NAME="a-grpc-server"
CLIENT_APP_NAME="a-grpc-client"

# Create the gRPC server app
echo "[INFO] Creating CE gRPC server application ${SERVER_APP_NAME}"
ibmcloud ce app create --name "${SERVER_APP_NAME}" --port h2c:8080 --min-scale 1 --build-source . --build-dockerfile Dockerfile.server

echo "[INFO] Retrieving gRPC server local endpoint"
SERVER_INTERNAL_ENDPOINT=$(ibmcloud ce app get -n "${SERVER_APP_NAME}" -o project-url | sed 's/http:\/\///')
echo "[INFO] Local endpoint is: ${SERVER_INTERNAL_ENDPOINT}"

# Create the client server app
echo "[INFO] Creating CE client/server application ${CLIENT_APP_NAME}"
ibmcloud ce app create --name "${CLIENT_APP_NAME}" --min-scale 1 --build-source . --build-dockerfile Dockerfile.client --env LOCAL_ENDPOINT_WITH_PORT="${SERVER_INTERNAL_ENDPOINT}:80"

# Get the client server public endpoint
echo "[INFO] Retrieving client/server public endpoint"
URL=$(ibmcloud ce app get -n "${CLIENT_APP_NAME}" -o url)
echo "[INFO] Endpoint is: ${URL}"

# Query the list of groceries by electronics category
echo "[INFO] Retrieving available electronic items"
curl -q "${URL}"/listgroceries/electronics

# Buy an item from electronics and pay with 2000
echo "[INFO] Going to buy an iphone"
curl -q "${URL}"/buygrocery/electronics/iphone/2000.0