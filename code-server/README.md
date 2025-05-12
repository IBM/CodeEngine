# Code Server Sample for Java Development


## Setting up the example

* Login to IBM Cloud via the CLI and target the desired region
    ```
    REGION=eu-es
    RESOURCE_GROUP=default
    ibmcloud login -r ${REGION} -g ${RESOURCE_GROUP}
    ```
* Create the Code Engine project
    ```
    CE_INSTANCE_NAME=code-server--ce
    ibmcloud code-engine project create --name ${CE_INSTANCE_NAME}

    CE_INSTANCE_GUID=$(ibmcloud ce project current -o json | jq -r .guid)
    ```

* Create the COS instance
    ```
    COS_INSTANCE_NAME=code-server--cos
    ibmcloud resource service-instance-create ${COS_INSTANCE_NAME} cloud-object-storage standard global

    COS_INSTANCE_ID=$(ibmcloud resource service-instance ${COS_INSTANCE_NAME} --output json | jq -r '.[0] | .id')
    ```
* Create the COS bucket
    ```
    ibmcloud cos config crn --crn ${COS_INSTANCE_ID}
    ibmcloud cos config auth --method IAM
    ibmcloud cos config region --region ${REGION}
    ibmcloud cos config endpoint-url --url s3.${REGION}.cloud-object-storage.appdomain.cloud
    COS_BUCKET_NAME=${CE_INSTANCE_GUID}-code-server
    ibmcloud cos bucket-create \
        --class smart \
        --bucket $COS_BUCKET_NAME
    ```
* Create the credentials to access the COS instance
    ```
    COS_HMAC_CREDENTIALS=$(ibmcloud resource service-key-create code-server-cos-credentials Writer --instance-id $COS_INSTANCE_ID --parameters '{"HMAC":true}' --output JSON)

    COS_HMAC_CREDENTIALS_ACCESS_KEY_ID=$(echo "$COS_HMAC_CREDENTIALS"|jq -r '.credentials.cos_hmac_keys.access_key_id')
    COS_HMAC_CREDENTIALS_SECRET_ACCESS_ID=$(echo "$COS_HMAC_CREDENTIALS"|jq -r '.credentials.cos_hmac_keys.secret_access_key')
    ```
* Obtain the KUBECONTEXT of the current Code Engine project
    ```
    ibmcloud ce project select --id ${CE_INSTANCE_GUID} --kubecfg
    ```
* As a CE user create the following secret resource within the project
    ```
    CE_SECRET_NAME=cos-secret-$COS_BUCKET_NAME
    kubectl apply -f - <<EOF
    apiVersion: v1
    kind: Secret
    type: codeengine.cloud.ibm.com/hmac-auth
    metadata:
        name: $CE_SECRET_NAME
    stringData:
        accessKey: $COS_HMAC_CREDENTIALS_ACCESS_KEY_ID
        secretKey: $COS_HMAC_CREDENTIALS_SECRET_ACCESS_ID
    EOF
    ```
* Create the PersistenStorage resource
    ```
    CE_STORAGE_NAME=$COS_BUCKET_NAME
    kubectl apply -f - <<EOF
    apiVersion: codeengine.cloud.ibm.com/v1beta1
    kind: PersistentStorage
    metadata:
    name: $CE_STORAGE_NAME
    spec:
    objectStorage:
        bucketName: $COS_BUCKET_NAME
        bucketLocation: $REGION
        secretRef: $CE_SECRET_NAME
    EOF
    ```

* Create the configuration for the code-server app:
    ```
    ibmcloud ce configmap create --name code-server-config --from-file config.yaml
    ```

* Create the code-server app 
    ```
    ibmcloud ce app create --name code-server \
        --build-source "." \
        --min-scale 1 \
        --port 12345 \
        --cpu 8 --memory 16G \
        --env CODE_SERVER_CONFIG=/home/coder/.config/code-server/config.yaml \
        --env MAVEN_OPTS="-Dmaven.repo.local=/data/cache/.m2" \
        --env VSCODE_PROXY_URI=./absproxy/{{port}} \
        --argument /data/workspace \
        --scale-down-delay 600 \
        --no-wait
    ```
* Patch the app to 
    ```
    ./add-volume-mount-to-app.sh $CE_APP_CODE_SERVER $CE_STORAGE_NAME /data
    ```
* Re-deploy the app including accurate code-server data
    ```
    ibmcloud ce app update --name code-server \
        --build-source "."
    ```

## Configuration

code-server

https://docs.code-server.org/en/latest/use/advanced/migrating.html

Base images
https://code-server-docker-stacks.readthedocs.io/en/latest/using/selecting.html

## Troubleshooting

```
ibmcloud ce app logs -n code-server -f
```