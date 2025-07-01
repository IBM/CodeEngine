#!/bin/sh

# Regions
COS_REGION_PRIMARY=au-syd
COS_REGION_SECONDARY=eu-es
PROJECT_REGION=eu-es
PROJECT_NAME="Cos2Cos"

# Resource groups
PROJECT_RESOURCE_GROUP=resource-group
COS_RESOURCE_GROUP_PRIMARY=resource-group
COS_RESOURCE_GROUP_SECONDARY=resource-group

#Creating a COS Instance
COS_INSTANCE_NAME_PRIMARY=cos-instance-one
COS_INSTANCE_NAME_SECONDARY=cos-instance-two

# Bucket names
COS_BUCKET_NAME_PRIMARY=cos-bucket-one
COS_BUCKET_NAME_SECONDARY=cos-bucket-two

# Endpoints
COS_ENDPOINT_PRIMARY=s3.au-syd.cloud-object-storage.appdomain.cloud
COS_ENDPOINT_SECONDARY=s3.eu-es.cloud-object-storage.appdomain.cloud

# Trusted Profile
TRUSTED_PROFILE_NAME=demo-trusted-profile

# Jobs
JOB_NAME=cos2cos-job

# Define registry credentials
BASE_SECRET=ce-secret
AUTH_SECRET=auth-secret

# Array Size of Job run Instance
ARRAY_SIZE=13