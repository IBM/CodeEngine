# Jupyter Sample


## Setting up the example

* Login to IBM Cloud via the CLI and target the ca-tor region
    ```
    REGION=eu-es
    RESOURCE_GROUP=default
    ibmcloud login -r ${REGION} -g ${RESOURCE_GROUP}
    ```
* Create the Code Engine project
    ```
    CE_INSTANCE_NAME=jupyter--ce
    ibmcloud code-engine project create --name ${CE_INSTANCE_NAME}

    CE_INSTANCE_GUID=$(ibmcloud ce project current -o json | jq -r .guid)
    CE_INSTANCE_ID=$(ibmcloud resource service-instance ${CE_INSTANCE_NAME} --output json | jq -r '.[0] | .id')
    ```

* Create the COS instance
    ```
    COS_INSTANCE_NAME=jupyter--cos
    ibmcloud resource service-instance-create ${COS_INSTANCE_NAME} cloud-object-storage standard global

    COS_INSTANCE_ID=$(ibmcloud resource service-instance ${COS_INSTANCE_NAME} --output json | jq -r '.[0] | .id')
    ```
* Create the COS bucket
    ```
    ibmcloud cos config crn --crn ${COS_INSTANCE_ID}
    ibmcloud cos config auth --method IAM
    ibmcloud cos config region --region ${REGION}
    ibmcloud cos config endpoint-url --url s3.${REGION}.cloud-object-storage.appdomain.cloud
    COS_BUCKET_NAME=${CE_INSTANCE_GUID}-jupyter
    ibmcloud cos bucket-create \
        --class smart \
        --bucket $COS_BUCKET_NAME
    ```
* Create the credentials to access the COS instance
    ```
    COS_HMAC_CREDENTIALS=$(ibmcloud resource service-key-create jupyter-cos-credentials Writer --instance-id $COS_INSTANCE_ID --parameters '{"HMAC":true}' --output JSON)

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
* Create a random app 
    ```
    ibmcloud ce app create --name jupyter \
        --build-source "." \
        --port 8888 \
        --no-wait
    ```
* Patch the app to 
    ```
    ./add-volume-mount-to-app.sh jupyter jupyter-002 $CE_STORAGE_NAME /mnt/ipynbs
    ```
* Re-deploy the app including accurate jupyter data
    ```
    ibmcloud ce app update --name jupyter \
        --build-source "."
    ```

## Adding proper authentication


## Prerequisites

* Create w3Id OIDC configuration through https://ies-provisioner.prod.identity-services.intranet.ibm.com/tools/sso/home
```
name: jupyter
homepage: https://jupyter-auth.<CE_SUBDOMAIN>.<REGION>.codeengine.appdomain.cloud
authz callback URL: https://jupyter-auth.<CE_SUBDOMAIN>.<REGION>.codeengine.appdomain.cloud/auth/callback
```
* Store the client id and the secret in local environment variable
```
CLIENT_ID=<CLIENT_ID>
CLIENT_SECRET=<CLIENT_SECRET>
```
* Generate a random cookie secret that is used to encrypt the auth cookie value
```
ENCRYPTION_KEY=$(dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64 | tr -d -- '\n' | tr -- '+/' '-_' ; echo)
```

## Configuration

JUPYTER_CONFIG_DIR

https://docs.jupyter.org/en/latest/use/advanced/migrating.html

Base images
https://jupyter-docker-stacks.readthedocs.io/en/latest/using/selecting.html

## Troubleshooting

```
ibmcloud ce app logs -n jupyter -f
```