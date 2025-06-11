#!/bin/sh
# This can be modified as per the User preference.

# Image details
CR_REGION=eu-es
RESOURCE_GROUP=demo-rg
REGISTRY=private.es.icr.io
REGISTRY_NAMESPACE=dummy
IMAGE_NAME=dev-cos2cos1
PROJECT_NAME="CE Internship"

# Regions
COS_REGION_PRIMARY=au-syd
COS_REGION_SECONDARY=eu-es
PROJECT_REGION=eu-es
PROJECT_RESOURCE_GROUP=demo-rg
PROJECT_NAME="Cos2Cos"

# Resource groups
COS_RESOURCE_GROUP_PRIMARY=demo-rg-primary
COS_RESOURCE_GROUP_SECONDARY=demo-rg-secondary

#Creating a COS Instance
COS_INSTANCE_NAME_PRIMARY=cos-instance-one
COS_INSTANCE_NAME_SECONDARY=cos-instance-two

# Bucket names
COS_BUCKET_NAME_PRIMARY=cos-bucket-one
COS_BUCKET_NAME_SECONDARY=cos-bucket-two

# Endpoints
COS_ENDPOINT_PRIMARY=s3.au-syd.cloud-object-storage.appdomain.cloud
COS_ENDPOINT_SECONDARY=s3.eu-es.cloud-object-storage.appdomain.cloud
# Timestamp
BUCKET_TIMESTAMP_FILENAME=last_modified_time.json

# CRTokenFilePath
IBM_COS_CRTokenFilePath_PRIMARY=/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token
IBM_COS_CRTokenFilePath_SECONDARY=/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token

# Trusted Profile
TRUSTED_PROFILE_NAME=demo-trusted-profile

# Jobs
JOB_NAME=cos2cos-job
JOB_IMAGE=private.es.icr.io/cos2cos/dev-cos2cos

# Define registry credentials
REGISTRY_SERVER=private.es.icr.io
BASE_SECRET=ce-secret
AUTH_SECRET=auth-secret
CONTAINER_REGISTRY_SECRET=container-registry-secret

API_KEY_NAME=api-key

# Array Size of Job run Instance
ARRAY_SIZE=13