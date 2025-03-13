# IBM Cloud Code Engine - Integrate Cloud Object Storage and PostgreSQL through a job and an event subscription

This sample demonstrates how to read CSV files hosted on a IBM Cloud Object Storage and save their contents line by line into relational PostgreSQL database.

## Prerequisites

Make sure the following [IBM Cloud CLI](https://cloud.ibm.com/docs/cli/reference/ibmcloud?topic=cloud-cli-getting-started) and the following list of plugins are installed
- `ibmcloud plugin install code-engine`
- `ibmcloud plugin install cloud-object-storage`

Install `jq`. On MacOS, you can use following [brew formulae](https://formulae.brew.sh/formula/jq) to do a `brew install jq`.
## CLI Setup

Login to IBM Cloud via the CLI
```
ibmcloud login 
```

Target the `ca-tor` region:
```
export REGION=ca-tor
ibmcloud -r $REGION
```

Create the project:
```
ibmcloud code-engine project create -n ce-objectstorage-to-sql
```

Store the project guid:
```
export CE_ID=$(ibmcloud ce project current -o json | jq -r .guid)
```

Create the job:
```
ibmcloud code-engine job create \
    --name csv-to-sql \
    --source ./ \
    --retrylimit 0 \
    --cpu 0.25 \
    --memory 0.5G \
    --wait
```

Create the app:
```
ibmcloud code-engine app create \
    --name csv-to-sql-app \
    --source ./ \
    --cpu 0.25 \
    --memory 0.5G \
    --env COS_REGION=eu-es \
    --env COS_TRUSTED_PROFILE_NAME=code-engine-cos-access \
    --env SM_TRUSTED_PROFILE_NAME=code-engine-sm-access \
    --env SM_SERVICE_URL=https://4e61488a-b76f-4d44-ba0e-ed2489d8a57a.private.eu-es.secrets-manager.appdomain.cloud \
    --env SM_PG_SECRET_ID=04abb32c-bbe3-a069-e4c4-8899853ef053
```

Create the COS instance:
```
ibmcloud resource service-instance-create csv-to-sql-cos cloud-object-storage standard global
```

Store the COS CRN:
```
export COS_ID=$(ibmcloud resource service-instance csv-to-sql-cos --output json | jq -r '.[0] | .id')
```

Create an authorization policy to allow the Code Engine project receive events from COS:
```
ibmcloud iam authorization-policy-create codeengine cloud-object-storage \
    "Notifications Manager" \
    --source-service-instance-id $CE_ID \
    --target-service-instance-id $COS_ID
```

Create a COS bucket:
```
ibmcloud cos config crn --crn $COS_ID --force
ibmcloud cos config auth --method IAM
ibmcloud cos config region --region $REGION
ibmcloud cos config endpoint-url --url s3.$REGION.cloud-object-storage.appdomain.cloud
export BUCKET=$CE_ID-csv-to-sql
ibmcloud cos bucket-create \
    --class smart \
    --bucket $BUCKET
```

Creating a trusted profile that grants a Code Engine Job access to your COS bucket
```
REGION=eu-es
RESOURCE_GROUP=Default
COS_INSTANCE_NAME=csv-to-sql-cos
COS_BUCKET=$CE_ID-csv-to-sql
CE_PROJECT_NAME=ce-objectstorage-to-sql
JOB_NAME=csv-to-sql
TRUSTED_PROFILE_NAME=code-engine-cos-access

CE_PROJECT_CRN=$(ibmcloud resource service-instance ${CE_PROJECT_NAME} --location ${REGION} -g ${RESOURCE_GROUP} --crn 2>/dev/null | grep ':codeengine:')
COS_INSTANCE_ID=$(ibmcloud resource service-instance ${COS_INSTANCE_NAME} --crn 2>/dev/null | grep ':cloud-object-storage:')

ibmcloud iam trusted-profile-create ${TRUSTED_PROFILE_NAME}
ibmcloud iam trusted-profile-link-create ${TRUSTED_PROFILE_NAME} --name ce-job-${JOB_NAME} --cr-type CE --link-crn ${CE_PROJECT_CRN} --link-component-type job --link-component-name ${JOB_NAME}
ibmcloud iam trusted-profile-policy-create ${TRUSTED_PROFILE_NAME} --roles "Content Reader" --service-name cloud-object-storage --service-instance ${COS_INSTANCE_ID} --resource-type bucket --resource ${COS_BUCKET}
```

Create the subscription for all COS events:
```
ibmcloud ce sub cos create \
    --name coswatch \
    --bucket $BUCKET \
    --destination csv-to-sql \
    --destination-type job

ibmcloud ce sub cos create \
    --name coswatch \
    --bucket $BUCKET \
    --destination csv-to-sql-app \
    --destination-type app \
    --path /cos-to-sql
```

Create a PostgreSQL service instance:
```
ibmcloud resource service-instance-create csv-to-sql-postgresql databases-for-postgresql standard $REGION --service-endpoints private -p \
 '{
    "disk_encryption_instance_crn": "none",
    "disk_encryption_key_crn": "none",
    "members_cpu_allocation_count": "0 cores",
    "members_disk_allocation_mb": "10240MB",
    "members_host_flavor": "multitenant",
    "members_members_allocation_count": 2,
    "members_memory_allocation_mb": "8192MB",
    "service-endpoints": "private",
    "version": "16"
}'
```

Create a trusted profile that grants this Code Engine job access to the COS instance 
```
REGION=eu-es
RESOURCE_GROUP=Default
COS_INSTANCE_NAME=my-first-cos
COS_BUCKET=my-first-bucket-31292
CE_PROJECT_NAME=trusted-profiles-test
JOB_NAME=list-cos-files
COS_TRUSTED_PROFILE_NAME=code-engine-cos-access
SM_TRUSTED_PROFILE_NAME=code-engine-sm-access
SM_SERVICE_URL=https://4e61488a-b76f-4d44-ba0e-ed2489d8a57a.private.eu-es.secrets-manager.appdomain.cloud
SM_PG_SECRET_ID=

CE_PROJECT_CRN=$(ibmcloud resource service-instance ${CE_PROJECT_NAME} --location ${REGION} -g ${RESOURCE_GROUP} --crn 2>/dev/null | grep ':codeengine:')
COS_INSTANCE_ID=$(ibmcloud resource service-instance ${COS_INSTANCE_NAME} --crn 2>/dev/null | grep ':cloud-object-storage:')

ibmcloud iam trusted-profile-create ${TRUSTED_PROFILE_NAME}
ibmcloud iam trusted-profile-link-create ${TRUSTED_PROFILE_NAME} --name ce-job-${JOB_NAME} --cr-type CE --link-crn ${CE_PROJECT_CRN} --link-component-type job --link-component-name ${JOB_NAME}
ibmcloud iam trusted-profile-policy-create ${TRUSTED_PROFILE_NAME} --roles "Content Reader" --service-name cloud-object-storage --service-instance ${COS_INSTANCE_ID} --resource-type bucket --resource ${COS_BUCKET}
```

Update the job by adding a binding to the PostgreSQL instance:
```
ibmcloud code-engine job update \
    --name csv-to-sql \
    --trusted-profiles-enabled true \
    --env COS_REGION=${REGION} \
    --env COS_TRUSTED_PROFILE_NAME=${COS_TRUSTED_PROFILE_NAME} \
    --env SM_TRUSTED_PROFILE_NAME=${SM_TRUSTED_PROFILE_NAME}\
    --env SM_SERVICE_URL=${SM_SERVICE_URL} \
    --env SM_PG_SECRET_ID=${SM_PG_SECRET_ID}
```

Create a Secrets Manager instance
```
ibmcloud resource service-instance-create credential-store secrets-manager 7713c3a8-3be8-4a9a-81bb-ee822fcaac3d eu-es -p \
'{
    "allowed_network": "private-only"
}'
```

// Create a Trusted Profile for Secrets Manager

// Create a S2S policy "Key Manager" between SM and the DB

// Create a service credential for PG with automatic key rotation



// ibmcloud secrets-manager secret-by-name --secret-type service_credentials --name pg-credentials --secret-group-name  --service-url https://4e61488a-b76f-4d44-ba0e-ed2489d8a57a.private.eu-es.secrets-manager.appdomain.cloud

// https://github.com/IBM/secrets-manager-node-sdk

Upload a CSV file to COS, to initate an event that leads to a job execution:
```
ibmcloud cos object-put \
    --bucket $BUCKET \
    --key users.csv \
    --body ./samples/users.csv \
    --content-type text/csv
```

List all jobs to determine the one, that processes the COS bucket update:
```
ibmcloud code-engine jobrun list \
    --job csv-to-sql \
    --sort-by age
```

Inspect the job execution by opening the logs:
```
ibmcloud code-engine jobrun logs \
    --name <jobrun-name>
```

Or do the two commands in one, using this one-liner:
```
jobrunname=$(ibmcloud ce jr list -j csv-to-sql -s age -o json | jq -r '.items[0] | .metadata.name') && ibmcloud ce jr logs -n $jobrunname -f
```


```
kubectl patch jobdefinitions csv-to-sql --type='json' -p='[{"op": "add", "path": "/spec/template/mountComputeResourceToken", "value":true}]'
kubectl patch ksvc csv-to-sql-app --type='json' -p='[{"op": "add", "path": "/spec/template/metadata/annotations/codeengine.cloud.ibm.com~1mount-compute-resource-token", "value":"true"}]'
```