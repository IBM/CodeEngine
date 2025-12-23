#!/bin/sh

source data.sh

alias ic=ibmcloud
ic target -g ${PROJECT_RESOURCE_GROUP}

set -e

# ========================================
# === Stage 1: Upload data files to COS ===
# ========================================
echo -e "\n\n Stage 1: Uploading files to Primary COS Bucket..."

UPLOAD_DIR="./input-data"

# Make sure COS instance CRN is configured
ibmcloud cos config crn --crn "${COS_INSTANCE_CRN_PRIMARY}" --force

for file in "$UPLOAD_DIR"/*; do
  [ -f "$file" ] || continue  # skip non-files
  filename=$(basename "$file")

  echo "Uploading $filename..."
  ibmcloud cos object-put \
    --bucket "${COS_BUCKET_NAME_PRIMARY}" \
    --key "$filename" \
    --region "${COS_REGION_PRIMARY}" \
    --body "$file"

  if [ $? -eq 0 ]; then
    echo "Uploaded $filename"
  else
    echo "Failed to upload $filename"
  fi
done


# ========================================
# === Stage 2: Show uploaded files     ===
# ========================================
echo -e "\n\n Stage 2: Listing uploaded files in Primary Bucket..."

ibmcloud cos config crn --crn "${COS_INSTANCE_CRN_PRIMARY}" --force

ibmcloud cos objects --bucket "${COS_BUCKET_NAME_PRIMARY}" --region "${COS_REGION_PRIMARY}"

# ========================================
# === Stage 3: Submit the Job          ===
# ========================================
echo -e "\n\n Stage 3: Submitting the job..."

RANDOM_CODE=$(printf "%06d" $((RANDOM % 1000000)))
JOB_RUN_NAME="${JOB_NAME}-${RANDOM_CODE}"

ibmcloud ce jobrun submit --job "${JOB_NAME}" --name "${JOB_RUN_NAME}" --array-size ${ARRAY_SIZE}

echo "Waiting for logs..."
sleep 5  # Give a few seconds for job to start before tailing logs

ibmcloud ce jobrun logs --name "${JOB_RUN_NAME}" --follow

# ========================================
# === Stage 4: Check files in Secondary ===
# ========================================
echo -e "\n\n Stage 4: Checking processed files in Secondary Bucket..."

ibmcloud cos config crn --crn "${COS_INSTANCE_CRN_SECONDARY}" --force

ibmcloud cos objects --bucket "${COS_BUCKET_NAME_SECONDARY}" --region "${COS_REGION_SECONDARY}"

# ========================================
# === Stage 5: Fetch one file from COS  ===
# ========================================
echo -e "\n\n Stage 5: Fetching a processed file from Secondary Bucket..."

# Example: Fetch `file.txt` back from secondary COS bucket
# Replace `file.txt` with actual processed object name

# curl -X GET \
#   -H "Authorization: Bearer $(cat ${IBM_COS_CRTokenFilePath_SECONDARY})" \
#   "https://${COS_BUCKET_NAME_SECONDARY}.${COS_ENDPOINT_SECONDARY}/tuples.py" \
#   -o downloaded_file.txt
for file in "$UPLOAD_DIR"/*; do
  [ -f "$file" ] || continue  # skip non-files
  filename=$(basename "$file")
  ibmcloud cos object-get --bucket ${COS_BUCKET_NAME_SECONDARY} --key $filename "output-data/processed_$filename"
  echo "Fetched file and saved as 'processed_$filename'"
done
# ========================================
# === DONE ===
# ========================================
echo -e "\n\nAll stages complete!"
