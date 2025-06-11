#!/bin/bash

source data.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# function accept bucket_name, region, instance_name, resource_group, type of bucket[primary,secondary], iteration
function create_instance_bucket(){
    COS_BUCKET_NAME=$1
    COS_REGION=$2
    COS_INSTANCE_NAME=$3
    COS_RESOURCE_GROUP=$4
    TYPE=$5
    I=$6
    
    echo "---"
    echo "Step $I: Creating COS $TYPE Instances and Bucket"
    echo "Step $I.1: $TYPE INSTANCE CREATION"
        echo "Checking if $TYPE instance exists"
        COS_INSTANCE_CRN=$(ibmcloud resource service-instance "${COS_INSTANCE_NAME}" --crn -q | head -n 1)

    if [ -z "$COS_INSTANCE_CRN" ]; then
        echo "Creating COS Instance $TYPE in ${COS_REGION}"
        COS_INSTANCE_CRN=$(ibmcloud resource service-instance-create "${COS_INSTANCE_NAME}" \
        cloud-object-storage standard global \
        -d premium-global-deployment-iam \
        -g "${COS_RESOURCE_GROUP}" | grep "ID:"| head -n 1 | awk '{print $2}')

        if [ -z "$COS_INSTANCE_CRN" ]; then
            echo -e "${RED}Failure${NC}: Step $I.1: Could not create COS Instance"
            exit 1
        fi
    else
        echo "COS Instance ${COS_INSTANCE_NAME} already exists."
    fi
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}Success${NC}: Step $I.1: $TYPE Instance creation: (${COS_INSTANCE_NAME}, ${COS_INSTANCE_CRN})"
    fi
    if [ $TYPE = "PRIMARY" ]; then
      COS_INSTANCE_CRN_PRIMARY=${COS_INSTANCE_CRN}
    else
      COS_INSTANCE_CRN_SECONDARY=${COS_INSTANCE_CRN}
    fi

    # Creating bucket in the instance - silent failure.
    echo "Step $I.2: Creating $TYPE Bucket."
    ibmcloud cos bucket-create \
    --bucket ${COS_BUCKET_NAME} \
    --class smart \
    --ibm-service-instance-id ${COS_INSTANCE_CRN} \
    --region ${COS_REGION} 2>/dev/null

    # Check if bucket exists.
    ibmcloud cos bucket-head --bucket "$COS_BUCKET_NAME" --region "$COS_REGION"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failure${NC}: Step $I.2: $TYPE Bucket does not exists. Exiting..."
        exit 1
    else
        echo -e "${GREEN}Success${NC}: Step $I.2: $TYPE Bucket Found."
    fi

}

# Creating PRIMARY Instance and Bucket
create_instance_bucket ${COS_BUCKET_NAME_PRIMARY} ${COS_REGION_PRIMARY} ${COS_INSTANCE_NAME_PRIMARY} ${COS_RESOURCE_GROUP_PRIMARY} "PRIMARY" "1"

# Creating SECONDARY Instance and Bucket
create_instance_bucket ${COS_BUCKET_NAME_SECONDARY} ${COS_REGION_SECONDARY} ${COS_INSTANCE_NAME_SECONDARY} ${COS_RESOURCE_GROUP_SECONDARY} "SECONDARY" "2"

# Create a Project if not exists.
echo "---"
echo "Step 3: Creating and selecting the project\n"
ibmcloud target -r ${PROJECT_REGION} -g ${PROJECT_RESOURCE_GROUP}
ibmcloud ce project create --name "${PROJECT_NAME}" -q
ibmcloud ce project select -n "${PROJECT_NAME}"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}SUCCESS${NC}: Step 3: Project Selected."
fi

# Get Project CRN
echo "---"
echo "Step 4: Getting the Project CRN\n"
PROJECT_CRN=$(ibmcloud resource service-instance "${PROJECT_NAME}" --location "${PROJECT_REGION}" -g "${PROJECT_RESOURCE_GROUP}" -q --crn)
if [ $? -eq 0 ]; then
  echo -e "${GREEN}SUCCESS${NC}: Step 4: Project CRN Fetched: $PROJECT_CRN"
fi
# Creating Trusted Profile
echo "---"
echo "Step 5: Creating/Fetching Trusted Profile $TRUSTED_PROFILE_NAME"
COS_TRUSTED_PROFILE_ID_PRIMARY=$(ibmcloud iam trusted-profile ${TRUSTED_PROFILE_NAME} --id)
if [ -z "$COS_TRUSTED_PROFILE_ID_PRIMARY" ] ; then
  COS_TRUSTED_PROFILE_ID_PRIMARY=$(ibmcloud iam trusted-profile-create "${TRUSTED_PROFILE_NAME}" -o JSON | jq -r '.id')
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failure${NC}: Step 5: Could not create trusted-profile.Exiting\n"
    exit 1
  fi
fi
COS_TRUSTED_PROFILE_ID_SECONDARY=$(echo ${COS_TRUSTED_PROFILE_ID_PRIMARY})
if [ $? -eq 0 ]; then
  echo -e "${GREEN}SUCCESS${NC}: Step 5: Trusted Profile Created/Fetched.\n"
fi

echo "-----"
echo "Step 6: Creating Secrets (Base Secret, Auth Secret, Registry Secret)"
echo "---"
echo "Step 6.1: Creating Base Secret: $BASE_SECRET"
ibmcloud ce secret create --name ${BASE_SECRET} \
  --from-literal SECONDARY_COS_BUCKET_NAME=${COS_BUCKET_NAME_SECONDARY} \
  --from-literal IBM_COS_RESOURCE_INSTANCE_ID_SECONDARY=${COS_INSTANCE_CRN_SECONDARY} \
  --from-literal IBM_COS_REGION_SECONDARY=${COS_REGION_SECONDARY} \
  --from-literal IBM_COS_ENDPOINT_SECONDARY=${COS_ENDPOINT_SECONDARY} \
  --from-literal PRIMARY_COS_BUCKET_NAME=${COS_BUCKET_NAME_PRIMARY} \
  --from-literal IBM_COS_RESOURCE_INSTANCE_ID_PRIMARY=${COS_INSTANCE_CRN_PRIMARY} \
  --from-literal IBM_COS_REGION_PRIMARY=${COS_REGION_PRIMARY} \
  --from-literal IBM_COS_ENDPOINT_PRIMARY=${COS_ENDPOINT_PRIMARY} \
  --from-literal BUCKET_TIMESTAMP_FILENAME=${BUCKET_TIMESTAMP_FILENAME}

if [ $? -ne 0 ]; then
  echo "Secret '${BASE_SECRET}' already exists."
  read -p "Do you want to override the existing secret? (y/n): " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "Updating secret ${BASE_SECRET}..."
    ibmcloud ce secret update --name ${BASE_SECRET} \
      --from-literal SECONDARY_COS_BUCKET_NAME=${COS_BUCKET_NAME_SECONDARY} \
      --from-literal IBM_COS_RESOURCE_INSTANCE_ID_SECONDARY=${COS_INSTANCE_CRN_SECONDARY} \
      --from-literal IBM_COS_REGION_SECONDARY=${COS_REGION_SECONDARY} \
      --from-literal IBM_COS_ENDPOINT_SECONDARY=${COS_ENDPOINT_SECONDARY} \
      --from-literal PRIMARY_COS_BUCKET_NAME=${COS_BUCKET_NAME_PRIMARY} \
      --from-literal IBM_COS_RESOURCE_INSTANCE_ID_PRIMARY=${COS_INSTANCE_CRN_PRIMARY} \
      --from-literal IBM_COS_REGION_PRIMARY=${COS_REGION_PRIMARY} \
      --from-literal IBM_COS_ENDPOINT_PRIMARY=${COS_ENDPOINT_PRIMARY} \
      --from-literal BUCKET_TIMESTAMP_FILENAME=${BUCKET_TIMESTAMP_FILENAME}

    if [ $? -eq 0 ]; then
      echo -e "${GREEN}SUCCESS${NC}: Step 6.1: Base secret update complete."
    else
      echo -e "${RED}ERROR${NC}: Failed to update secret."
      exit 1
    fi
  else
    echo "Secret update cancelled by user. Exiting..."
    exit 0
  fi
else
  echo -e "${GREEN}SUCCESS${NC}: Step 6.1: Base secret creation complete."
fi

# Creating a container registry secret
echo "---"
echo "Step 6.2: Creating Container Registry Secret: $CONTAINER_REGISTRY_SECRET"
echo "Step 6.2.1: Checking if API key '${API_KEY_NAME}' exists"
API_KEY=$(ibmcloud iam api-keys --output json | jq -r ".[] | select(.name == \"$API_KEY_NAME\") | .apikey")

if [ -z "$API_KEY" ]; then
  echo "API key '${API_KEY_NAME}' does not exist. Creating a new one..."
  API_KEY=$(ibmcloud iam api-key-create ${API_KEY_NAME} -d "API Key for IBM CR COS-to-COS" -o JSON | jq -r '.apikey' )
  # ibmcloud iam api-key-create ${API_KEY_NAME} -d "API Key for IBM CR COS-to-COS" --file key_file
  echo "API key '${API_KEY_NAME}' created."
else
  echo "API key '${API_KEY_NAME}' already exists. Skipping creation."
fi

ibmcloud ce secret create --name ${CONTAINER_REGISTRY_SECRET} --format registry --password ${API_KEY} --server ${REGISTRY_SERVER}
if [ $? -ne 0 ]; then
    echo "Secret '${CONTAINER_REGISTRY_SECRET}' already exists."
    read -p "Do you want to override the existing container registry secret? (y/n): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo "Updating secret ${CONTAINER_REGISTRY_SECRET}..."
        ibmcloud ce secret update --name ${CONTAINER_REGISTRY_SECRET} --password ${API_KEY} --server ${REGISTRY_SERVER}
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}SUCCESS${NC}: Step 6.2: Container Registry secret update complete."
        else
            echo -e "${RED}ERROR${NC}: Failed to update container registry secret."
            exit 1
        fi
    else
        echo "Container registry secret update cancelled by user. Exiting..."
        exit 0
    fi
else
    echo -e "${GREEN}SUCCESS${NC}: Step 6.2: Container Registry secret creation complete."
fi
# Auth secrets
echo "---"
echo "Step 6.3: Creating Auth Secret: $AUTH_SECRET"
ibmcloud ce secret create --name ${AUTH_SECRET} \
  --from-literal IBM_COS_CRTokenFilePath_PRIMARY=${IBM_COS_CRTokenFilePath_PRIMARY} \
  --from-literal IBM_COS_CRTokenFilePath_SECONDARY=${IBM_COS_CRTokenFilePath_SECONDARY} \
  --from-literal IBM_COS_TRUSTED_PROFILE_ID_PRIMARY=${COS_TRUSTED_PROFILE_ID_PRIMARY} \
  --from-literal IBM_COS_TRUSTED_PROFILE_ID_SECONDARY=${COS_TRUSTED_PROFILE_ID_SECONDARY}
if [ $? -ne 0 ]; then
    echo "Secret '${AUTH_SECRET}' already exists."
    read -p "Do you want to override the existing auth secret? (y/n): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo "Updating secret ${AUTH_SECRET}..."
        ibmcloud ce secret update --name ${AUTH_SECRET} \
          --from-literal IBM_COS_CRTokenFilePath_PRIMARY=${IBM_COS_CRTokenFilePath_PRIMARY} \
          --from-literal IBM_COS_CRTokenFilePath_SECONDARY=${IBM_COS_CRTokenFilePath_SECONDARY} \
          --from-literal IBM_COS_TRUSTED_PROFILE_ID_PRIMARY=${COS_TRUSTED_PROFILE_ID_PRIMARY} \
          --from-literal IBM_COS_TRUSTED_PROFILE_ID_SECONDARY=${COS_TRUSTED_PROFILE_ID_SECONDARY}
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}SUCCESS${NC}: Step 6.3: Auth secret update complete."
        else
            echo -e "${RED}ERROR${NC}: Failed to update auth secret."
            exit 1
        fi
    else
        echo "Auth secret update cancelled by user. Exiting..."
        exit 0
    fi
else
    echo -e "${GREEN}SUCCESS${NC}: Step 6.3: Auth secret creation complete."
fi
# Create a job
# Create the job with environment variables, including the bucket's region
echo "-----"
echo "Step 7: Creating JOB with name $JOB_NAME"
ibmcloud ce job create --name ${JOB_NAME} --image "${JOB_IMAGE}" \
  --registry-secret ${CONTAINER_REGISTRY_SECRET} \
  --env-from-secret ${BASE_SECRET} \
  --env-from-secret ${AUTH_SECRET} \
  --argument true 2>/dev/null
if [ $? -ne 0 ]; then
  # echo "Job '${JOB_NAME}' already exists. Exiting"
  # exit 1

  echo "Job '${JOB_NAME}' already exists. Updating Job."
  ibmcloud ce job update --name ${JOB_NAME} --image "${JOB_IMAGE}" \
  --registry-secret ${CONTAINER_REGISTRY_SECRET} \
  --env-from-secret ${BASE_SECRET} \
  --env-from-secret ${AUTH_SECRET} \
  --argument true 2>/dev/null
fi
if [ $? -eq 0 ]; then
echo -e "${GREEN}SUCCESS${NC}Step 7: Job Created" 
fi

# Create a link to a compute resource for a trusted profile
echo "-----"
echo "Step 8.1: Linking JOB To Trusted Profile"
ibmcloud iam trusted-profile-link-create ${TRUSTED_PROFILE_NAME} \
  --name ce-job-${JOB_NAME} \
  --cr-type CE \
  --link-crn ${PROJECT_CRN} \
  --link-component-type job \
  --link-component-name "${JOB_NAME}" 2>/dev/null


# Add IAM policies for bucket access - Grant access to the bucket the job needs
echo "Step 8.2: Linking Primary COS To Trusted Profile"
ibmcloud iam trusted-profile-policy-create ${TRUSTED_PROFILE_NAME} \
--roles "Writer" \
--service-name cloud-object-storage \
--service-instance ${COS_INSTANCE_CRN_PRIMARY} 2>/dev/null
# echo "***** DONE: Linking Primary COS To Trusted Profile"

echo "Step 8.3: Linking Secondary COS To Trusted Profile"
ibmcloud iam trusted-profile-policy-create ${TRUSTED_PROFILE_NAME} \
--roles "Writer" \
--service-name cloud-object-storage \
--service-instance ${COS_INSTANCE_CRN_SECONDARY} 2>/dev/null
# echo "***** DONE: Linking Secondary COS To Trusted Profile"

echo "Step 8.4: Compute Resource Token"
curl \
  --request PATCH "https://api.${PROJECT_REGION}.codeengine.cloud.ibm.com/v2/projects/$(ibmcloud ce project current --output json | jq -r .guid)/jobs/${JOB_NAME}" \
  --header 'Accept: application/json' \
  --header "Authorization: $(ibmcloud iam oauth-tokens --output json | jq -r '.iam_token')" \
  --header 'Content-Type: application/merge-patch+json' \
  --header 'If-Match: *' \
  --data-raw "{
    \"run_compute_resource_token_enabled\": true
  }" 2>/dev/null
# echo "******* DONE: Compute Resource Token *******"

# echo "-----"
# echo "Step 9"
# # Submit the job
# echo "LIVE !"
# echo " ********** Submitting the job and Logs *********"
# RANDOM_CODE=$(printf "%06d" $((RANDOM % 1000000)))
# ibmcloud ce jobrun submit --job ${JOB_NAME} --name ${JOB_NAME}-${RANDOM_CODE}
# ibmcloud ce jobrun logs --name ${JOB_NAME}-${RANDOM_CODE} --follow
