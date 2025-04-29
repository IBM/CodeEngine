# IBM Fotobox

This is the IBM Fotobox. Deploy your own Fotobox straight to the IBM Cloud Access it directly from any device with browser and camera. Take Pictures and view them all from your device. 

The solution is based on:
- The frontend a Svelte Single Page Application running as a App on Code Engine able to scale to 0 in oder to optimise cost.
- The Upload function which generates a thumbnail of the image and stores both in COS written in Python and running as a Function on Code Engine.
- The Downloader a Go programm designed to serve the images stored in COS or download all at one go if you are the operator of the fotobox.
- All Images are stored in IBM Cloud Object Storage to ensure security and scalability. 

## Setup

If you use your own machine you'll need to install the following (if not
already installed) and make sure you have a IBM Cloud Account:

- [IBM Cloud command line (`ibmcloud`)](https://cloud.ibm.com/docs/cli/reference/ibmcloud?topic=cloud-cli-getting-started)
- [Code Engine plugin (`ce`)](https://cloud.ibm.com/codeengine/cli)
- [Terraform ](https://developer.hashicorp.com/terraform/install)
- [jq](https://jqlang.org/)


## Automated Setup

In order to make the setup as convinent as possible we probide you with a setupscript which uses teraform and the IBM Cloud CLI

1. configure the `terraform.auto.tfvars` with your apikey and your resource group id 

2. Run the `setup.sh <apikey>`and it will deploy all the required components and done

## Manual setup

1. Setup COS with cos bucket this can be done over the UI or using the CLI  
    note dont the bucket name and API credentials

2. Deploy the Upload Function using the CLI
    ```bash
    ibmcloud ce fn create --name fotobox-cos-upload  --runtime python  --build-source upload-function
    ```

3. Deploy the Download App using the CLI
    ```bash
    ibmcloud ce app create --name fotobox-get-pics --build-dockerfile Dockerfile  --build-source download-app
    ```

4. Create a Secret map containing the following values. use the following command to create the password
    ```bash
    echo -n "password" | sha256
    5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8

    ```
    Secrets/environment variables
    ```
    apikey="cos api key mus upload und download können"
    resource_instance_id="cos credential"
    bucket="mybucket"
    imageprefix="my-event-"
    passwords="5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
    ```

5. Reference the full secret to the function and the app

6. inside the the [stores.js](frontend-app/src/stores.js) replace the URLs to the upload function and download app


```javascript
export const uploadURL = "<replace with public function url>"
export const downloadURL = "<replace with download app url"
```

7. Deploy the app with the updates
```bash
ibmcloud ce app create --name fotobox-frontend --build-dockerfile Dockerfile  --build-source frontend-app
```

Now the Fotobox should be deployed and usable