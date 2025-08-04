# Code Engine Gallery Demo

This tutorial demonstrates how to build an Image Gallery that demonstrates how multiple Code Engine components can be used together in order to build a complex software solution.

The solution is based on:
- an application that renders a web application and which is capable to get extended to connect to an Object Storage bucket to store gallery images
- a function that is capable to read and write to a COS bucket and change the colors of a single PNG image that is stored in the bucket
- a job that that is capable to read and write to a COS bucket and change the colors of a all PNG images that are stored in the bucket


![Tutorial overview](./docs/tutorial-overview.png)

## Setup

### Prererquisites

If you use your own machine you'll need to install the following (if not
already installed):
- [IBM Cloud command line (`ibmcloud`)](https://cloud.ibm.com/docs/cli/reference/ibmcloud?topic=cloud-cli-getting-started)
- [Code Engine plugin (`ce`)](https://cloud.ibm.com/codeengine/cli)
- [Cloud Object Storage plugin (`cos`)](https://cloud.ibm.com/docs/cloud-object-storage-cli-plugin)

Furthermore, you'll need to have `jq` installed on your local machine. On MacOS, you can use [Homebrew](https://brewinstall.org/) to install this tool:
```
$ brew install jq
```

### Project

Login into IBM Cloud using the CLI 
```
> ibmcloud login 
```

Choose a proper region and resource group. In this script, we'll use the Frankfurt region and the default resource group.
```
> REGION=eu-de

> ibmcloud target -r $REGION
```

Create a new project 
```
> ibmcloud ce project create --name gallery 

Creating project 'gallery'...
ID for project 'gallery' is '91efff97-1001-4144-997a-744ec8009303'.
Waiting for project 'gallery' to be active...
Now selecting project 'gallery'.
OK
```

Read the project guid from the CLI output and store it in a local variable. 
We'll need it later on to configure the bucket.
```
$ export CE_PROJECT_GUID=$(ibmcloud ce project current --output json|jq -r '.guid')
$ echo "CE_PROJECT_GUID: $CE_PROJECT_GUID"

CE_PROJECT_GUID: 91efff97-1001-4144-997a-744ec8009303

$ export CE_PROJECT_CRN=$(ibmcloud ce project get --name gallery --output json|jq -r '.crn')
$ echo "CE_PROJECT_CRN: $CE_PROJECT_CRN"

CE_PROJECT_CRN: crn:v1:bluemix:public:codeengine:eu-de:a/7658687ea07db8386963ebe2b8f1897a:91efff97-1001-4144-997a-744ec8009303::
```

Once the project has become active, you are good to proceed with the next step.

### Gallery application

Create an application
```
> ibmcloud ce app create --name gallery --image icr.io/codeengine/gallery

Creating application 'gallery'...
Configuration 'gallery' is waiting for a Revision to become ready.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready.
Run 'ibmcloud ce application get -n gallery' to check the application status.
OK

https://gallery.172utxcdky5l.eu-de.codeengine.appdomain.cloud
```

That deployed the application is a very basic web application, which is able 
to compose an image gallery by either dragging the sample images into 
the preview box and click `Add`. Furthermore, it is possible to upload images 
from the local workstation, by clicking `Upload`. 

Note, that the image gallery will reset, once the app instance tears down.

![Gallery application](./docs/application-in-memory.png)

### Setting up the Cloud Object Storage instance and the bucket

Now that we've proven that the logic of our image gallery works, we need
to change things a bit so that instead of just storing the gallery images in 
the users browser, we're going to store them in a persistent store - or
in this case IBM Cloud Object Storage. 

First we'll create a new instance of that service:
```
> ibmcloud resource service-instance-create gallery-cos \
    cloud-object-storage standard global -d premium-global-deployment-iam

Creating service instance gallery-cos in resource group default of account John Doe's Account as abc@ibm.com...
OK
Service instance gallery-cos was created.
                  
Name:             gallery-cos
ID:               crn:v1:bluemix:public:cloud-object-storage:global:a/7658687ea07db8386963ebe2b8f1897a:c0f324be-33fd-4989-a4af-376a13abb316::
GUID:             c0f324be-33fd-4989-a4af-376a13abb316
Location:         global
State:            active
Type:             service_instance
Sub Type:         
Allow Cleanup:    false
Locked:           false
Created at:       2023-09-08T07:38:48Z
Updated at:       2023-09-08T07:38:50Z
Last Operation:             
                  Status    create succeeded
                  Message   Completed create instance operation
```

From this output you'll need to save the `ID` value for a future command.
So to make life easier, let's save it as an environment variable:

```
> export COS_INSTANCE_ID=$(ibmcloud resource service-instance gallery-cos --output json|jq -r '.[]|.id')
> echo "COS_INSTANCE_ID: $COS_INSTANCE_ID" 
```

Let's direct all COS CLI uses to our COS instance:
```
> ibmcloud cos config crn --crn $COS_INSTANCE_ID --force

Saving new Service Instance ID...
OK
Successfully stored your service instance ID.
```

Now, let's use the "IAM" authentication method which will use the same API Key
that the rest of our CLI commands will use:

```
> ibmcloud cos config auth --method IAM

OK
Successfully switched to IAM-based authentication. The program will access your Cloud Object Storage account using your IAM Credentials.
```

Last, let's set the region for the bucket
```
> ibmcloud cos config region --region ${REGION}

OK
Successfully saved default region. The program will look for buckets in the region eu-de.
```

Next, let's go ahead and create a new bucket into which our data will be stored.
To do this you'll need to provide a unique name for your bucket. It needs to be
globally unique across all buckets in the IBM Cloud. In the command below
we'll use our project's ID appended with "-gallery", but you can technically use any value you want as long as it's unique. Let's save that name in an environment variable for
easy use:

```
> export BUCKET="$CE_PROJECT_GUID-gallery"
> echo "BUCKET: $BUCKET"
```

Now, let's ask COS to create our bucket:

```
> ibmcloud cos bucket-create --bucket $BUCKET

OK
Details about bucket 91efff97-1001-4144-997a-744ec8009303-gallery:
Region: eu-de
Class: Standard
```

In order to enable the Code Engine app to interact with the COS bucket, we'll create a service credential that contains HMAC credentials, store it in a Code Engine secret and create a persistent data store so that Code Engine components can mount the bucket.
```
> COS_HMAC_CREDENTIALS=$(ibmcloud resource service-key-create gallery-cos-credentials Writer --instance-id $COS_INSTANCE_ID --parameters '{"HMAC":true}' --output JSON)

> ibmcloud ce secret create --name gallery-cos-hmac-credentials \
    --format hmac \
    --access-key-id "$(echo "$COS_HMAC_CREDENTIALS"|jq -r '.credentials.cos_hmac_keys.access_key_id')" \
    --secret-access-key "$(echo "$COS_HMAC_CREDENTIALS"|jq -r '.credentials.cos_hmac_keys.secret_access_key')"

Creating hmac_auth secret 'gallery-cos-hmac-credentials'...
OK

> ibmcloud ce persistentdatastore create --name gallery-cos-pds --cos-bucket-name $BUCKET --cos-access-secret gallery-cos-hmac-credentials

Successfully created persistent data store named 'gallery-cos-pds'.
OK
```

To complete this setup, we'll need to adjust the application configuration and make it aware of the persistence store.
```
> ibmcloud ce app update --name gallery \
    --mount-data-store /mnt/bucket=gallery-cos-pds: \
    --env MOUNT_LOCATION=/mnt/bucket \
    --scale-down-delay 3600

Updating application 'gallery' to latest revision.
Traffic is not yet migrated to the latest revision.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready.
Run 'ibmcloud ce application get -n gallery' to check the application status.
OK

https://gallery.172utxcdky5l.eu-de.codeengine.appdomain.cloud
```

Open the gallery application in your browser. Notice the Gallery title on the right-hand side has slightly changed. It now says `My Gallery hosted on IBM Cloud Object Storage`. Play around with the gallery by adding a few images. Notice, that the gallery images re-appear after reloading the page.

![Gallery application backed by COS](./docs/application-with-cos.png)

### Add a function that changes the colors of gallery images

Now, let us further extend the solution by adding a function that is capable of changing the color of an individual image. The source code of the gallery app is prepared to enable an onClick handler on each gallery image that calls a function endpoint. Functions are designed to respond lightning fast and as such their are ideal for use cases that require a fast response. As opposed to apps, functions must only contain the source code that is essential for executing the desired business logic.

```
git clone git@github.com:IBM/CodeEngine.git
```

Nabigate to the subfolder `function` within the gallery tutorial.

```
cd gallery/function
```

Utilize local build capabilities, which is able to take your local source code and convert it into an executable artifact and create a new function called `change-color`.

```
$ ibmcloud ce fn create --name change-color \
    --build-source . \
    --runtime nodejs-22 \
    --memory 4G \
    --cpu 1 \
    --env TRUSTED_PROFILE_NAME=ce-gallery-to-cos \
    --env COS_BUCKET=$BUCKET \
    --env COS_REGION=$REGION \
    --trusted-profiles-enabled \
    --visibility project

Preparing function 'change-color' for build push...
Creating function 'change-color'...
Packaging files to upload from source path '.'...
Submitting build run 'change-color-run-230912-101533983'...
Creating image 'private.de.icr.io/ce--76586-172utxcdky5l/function-change-color:230912-0815-mrawq'...
Waiting for build run to complete...
Build run status: 'Running'
Build run completed successfully.
Run 'ibmcloud ce buildrun get -n change-color-run-230912-101533983' to check the build run status.
Waiting for function 'change-color' to become ready...
Function 'change-color' is ready.
OK                                                
Run 'ibmcloud ce function get -n change-color' to see more details.

https://change-color.172utxcdky5l.eu-de.codeengine.appdomain.cloud
```

In order to allow the function to read and write to the bucket, we'll need to create an IAM trusted profile between the COS instance and the function to expose the Object Storage credentials to the functions code. 

```
$ ibmcloud iam trusted-profile-create ce-gallery-to-cos

$ ibmcloud iam trusted-profile-link-create ce-gallery-to-cos --name ce-fn-change-color --cr-type CE --link-crn ${CE_PROJECT_CRN} --link-component-type function --link-component-name change-color

$ ibmcloud iam trusted-profile-policy-create ce-gallery-to-cos --roles "Writer" --service-name cloud-object-storage --service-instance ${COS_INSTANCE_ID} --resource-type bucket --resource ${BUCKET}
```

In order to complete this step, we'll update the app and make it aware that there is a function that allows to change the colors of individual images.

```
$ ibmcloud ce app update --name gallery \
    --env COLORIZER=change-color

Updating application 'gallery' to latest revision.
Traffic is not yet migrated to the latest revision.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready.
Run 'ibmcloud ce application get -n gallery' to check the application status.
OK

https://gallery.172utxcdky5l.eu-de.codeengine.appdomain.cloud
```

Open the gallery application in your browser. Notice that a Gallery subtitletitle on the right-hand side has appeared. It now says `Click on individual images to change their colors.`. Play around with the gallery by clickon on a few images. Notice, that the gallery images change their colors after a short amount of time.

![Gallery application that can change colors](./docs/application-with-function.png) 

### Add a job that process the whole bucket as a bulk

In the next step of this tutorial we'll want to add the job, which is capable of processing the whole bucket and change the color of each of the images in a bulk operation. 

Create a job. Note: this time we are configuring the target COS bucket right-away as part of the creation. 
```
$ ibmcloud ce job create --name bulk-process \
    --image icr.io/codeengine/gallery-job \
    --env BUCKET=$BUCKET

Creating job 'bulk-process'...
OK
```

Bind the job to the COS bucket by using the very same credentials that have been shared with the app and function, too. 
```
$ ibmcloud ce job bind --name bulk-process \
    --service-instance gallery-cos \
    --service-credential $COS_SERVICE_CREDENTIAL

Binding service instance...
Status: Done
OK
```

Open the gallery application in your browser and clear the whole gallery by clicking the clear button. Afterwards, make sure to add a ton of images to the gallery. 

![Gallery that contains a lot of images](./docs/application-with-many-images.png) 

Submit a job run that process all images
```
$ ibmcloud ce jobrun submit --job bulk-process

Getting job 'bulk-process'...
Submitting job run 'bulk-process-jobrun-mjkf4'...
Run 'ibmcloud ce jobrun get -n bulk-process-jobrun-mjkf4' to check the job run status.
OK
```

Once the jobrun has been completed, re-load the gallery app in the browser. Notice that the colors of all images have been changed:

![Gallery in which all colors have been changed](./docs/application-with-changed-colors.png) 
