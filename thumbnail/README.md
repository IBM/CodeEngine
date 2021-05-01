# Code Engine Thumbnail Tutorial

In this tutorial we'll be using Code Engine to walk through a common pattern
of how an application will morph over time from just a prototype to one that
will then be used in production.

To keep the example simple, we'll be creating an image transformation service
that will "process" an image by examining it and creating a "thumbnail"
version of it. The code itself to do this transformation isn't really the
point of this tutorial, rather it's the "growing up" of the infrastructure
around the application and how Code Engine can make that easier.

The overall growth path that our application will take is:
- deploy a simple webapp as a prototype to prove that our core "thumbnail"
  processing logic works. Everything is self-contained in this one webapp.
- add some persistence so that as images are uploaded they are saved for
  safe keeping and so that we can off-load the processing to a background
  process since in many scenarios the "transformation" logic may take a while.
  This also allows for other mechanisms, aside from our webapp, to upload
  the images - for cases where the data being processed could be coming from
  multiple sources.
- finally, we'll convert this "off-line" processing into something more
  event-driven so that we can process the images in real-time/immediately.

## Initial Setup

See the [main README](../README.md) for additional information about
[getting started](../README.md#getting-started), but the main points are
described below.

You can work through this tutorial using the
[IBM Cloud Shell](https://cloud.ibm.com/shell) service in your browser, or
you can install the necessary CLI tools on your own machine.

If you use [Cloud Shell](https://cloud.ibm.com/shell) then make sure you
run:
```console
$ ibmcloud plugin update --all --force
```
to ensure you have the latest versions of the CLI plugins.

If you use your own machine you'll need to install the following (if not
already installed):
- [IBM Cloud command line (`ibmcloud`)](https://cloud.ibm.com/docs/cli/reference/ibmcloud?topic=cloud-cli-getting-started)
- [Code Engine plugin (`ce`)](https://cloud.ibm.com/codeengine/cli)
- [Cloud Object Storage plugin (`cos`)](https://cloud.ibm.com/docs/cloud-object-storage-cli-plugin)

Finally, make sure you have an IBM Cloud resource group specified. You can see
 the list of available resource groups via:
```console
> ibmcloud resoure groups

Retrieving all resource groups under account 7f89ab187ae6557f2c0f53244a246d44 as abc@us.ibm.com...
OK
Name      ID                                 Default Group   State
default   f23e5930aa034c1a86ee479af10c5005   true            ACTIVE
```

And then select one:
```console
> ibmcloud target -g default

Targeted resource group default

API endpoint:      https://cloud.ibm.com
Region:            us-south
User:              abc@us.ibm.com
Account:           John Doe's Account (7f89ab187ae6557f2c0f53244a246d44) <-> 1516981
Resource group:    default
CF API endpoint:
Org:
Space:
```

## Part 1 - Deploying our first application

Before we begin let's first discuss how the image transformation (i.e.
thumbnail generator) works. It's rather simple, it takes an image (as an
array of bytes) and then returns the thumbnail, again as an array of bytes.
As mentioned in the introduction, the code here isn't really that important,
and can easily be replaced with other (more complex) logic, but if you're
interested you can see the logic in the [`MakeThumbnail`](v1/app.go) function.

In this first step we'll be deploying a webapp that wrappers this
`MakeThumbnail` function with some HTTP processing logic to allow users to
upload an image via a browser. The webapp will then call `MakeThumbnail`
to generate the thumbnail and then return it back to the user. Of course,
displaying the results in their browser.

To get started we first need to have a Code Engine "project". A project is
a grouping of applications and batch job that have a logical relationship
to the developer. For example, perhaps they're all part of the same product.
How workloads
are split across projects is up to the developer, but one thing to remember
is that workloads within a project can talk to each other over a private
network, while talking across projects will not. That's something to consider
when grouping things.

If you already have a project then you can skip this first command if you'd
like, but if you have not created one yet then let's create one:

```console
> ibmcloud ce project create --name thumbnail

Creating project 'thumbnail'...
ID for project 'thumbnail' is '411d3b74-3027-4a50-ab0c-0e7df2767832'.
Waiting for project 'thumbnail' to be active...
Now selecting project 'thumbnail'.
OK
```

By default creating the project will also "select" it so that all future
`ibmcloud ce` commands will be scoped to the project. If you are using
an existing project make sure you've selected it via the `ibmcloud ce
project select` command.

In this tutorial we've already pre-built most of the container images
for you, so let's immediately go ahead and deploy our initial version of
the webapp by creating a Code Engine application.

Before we do that though, it's important to understand a bit about the
types of workloads that Code Engine supports.
Code Engine supports two types of workloads:
- Applications
- Batch Jobs

Applications are any workloads that typically respond to incoming messages.
Whether those messages are API calls, web page requests, events, or any other
HTTP request, Applications process those messages. Code Engine will then
scale your applications based on the amount of incoming traffic - to meet
that demand. Likewise it will scale your application back down when there
is a reduction in traffic - even down to zero. This means that you only pay
when your application is actually running, and nothing when it is scaled to
zero.

Batch jobs are slightly different from applications in that they do not
typically respond to incoming messages. Often referred to as "run to
completion" tasks, batch jobs are meant to be created, then they execute a
particular operation, and then when done they exit.

With that, let's now return to deploying our application.

To do this we only need to provide two pieces of information:
- the name of our application - `thumbnail` in this case.
  You could name it anything you want, but below we'll use this name
- the container image to use - `ibmcom/thumbnail`. This is a pre-built
  container image in a public container register (DockerHub)

And then we'll use the Code Engine (ce) `app create` command:

```console
$ ibmcloud ce app create --name thumbnail --image ibmcom/thumbnail

Creating application 'thumbnail'...
The Configuration is still working to reflect the latest desired specification.
The Route is still working to reflect the latest desired specification.
Configuration 'thumbnail' is waiting for a Revision to become ready.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready
Run 'ibmcloud ce application get -n thumbnail' to check the application status.
OK

https://thumbnail.79gf3v2htsc.us-south.codeengine.appdomain.cloud
```

You'll notice that at the end of the output is a URL. This is where your
application is now running. Go ahead and copy this URL into your browser
and you should see our thumbnail application.

Let's also save this URL as environment variable so we can use it later:
```console
$ export URL=https://thumbnail.79gf3v2htsc.us-south.codeengine.appdomain.cloud
```

<!-- export URL=$(tail -1 out) -->

It's a very basic application where you can drag-n-drop one of the images into
the first box, or upload your own image if you wish. Once there is an image
in there, go ahead and hit the "Generate Thumbnail" button to process the
image. The resulting thumbnail should appear in the right-hand box.

Let's pause here for a moment to understand what we just did. With just two
pieces of information (application name and container image) we've now
deployed an internet facing application that is secure (notice the `https`
in the URL), and will scale up and down based on how much it is used.

Not only was this trivial to do, but it also completes the first part of this
tutorial.

## Part 2 - Setup our persistence

Now that we've proven that the logic of our thumbnail processor works, we need
to change things a bit so that instead of assuming the incoming images are
coming from a web page, we're going to get them from a persistent store - or
in this case IBM Cloud Object Storage. We're doing this because in our
production environment the data we're going to process might be coming from
many different sources and we need to keep both the original and processed
data for our records - meaning we need to save both the image and its
thumbnail.

In the end, what this really means is that our web application might
eventually go away or it could be just one of many ways in which our
datastore is populated. So its role switches from "the processor" to just a
web front-end application.

The other change in processing logic we're going to make is to move the
thumbnail processing out of the webapp, again since it might not be the only
way images are put into our datastore, and into a separate workload that
we'll invoke outside of the webapp. But more on that later, for now let's
focus on setting up the datastore.

As mentioned, our datastore is going to be Cloud Object Storage so we'll
need to first create a new instance of that service:

```console
$ ibmcloud resource service-instance-create thumbnail-cos \
    cloud-object-storage lite global

Creating service instance thumbnail-cos in resource group default of account John Doe's Account as abc@us.ibm.com...
OK
Service instance thumbnail-cos was created.

Name:             thumbnail-cos
ID:               crn:v1:bluemix:public:cloud-object-storage:global:a/7f9dc5344476457f2c0f53244a246d44:49ceebdf-28dc-46df-bbe2-809a680cebbe::
GUID:             49ceebdf-28dc-46df-bbe2-809a680cebbe
Location:         global
State:            active
Type:             service_instance
Sub Type:
Allow Cleanup:    false
Locked:           false
Created at:       2021-04-02T18:30:31Z
Updated at:       2021-04-02T18:30:31Z
Last Operation:
                  Status    create succeeded
                  Message   Completed create instance operation
```

From this output you'll need to save the `ID` value for a future command.
So to make life easier, let's save it as an environment variable:

```console
$ export COS_ID=crn:v1:bluemix:public:cloud-object-storage:global:a/7f9dc5344476457f2c0f53244a246d44:49ceebdf-28dc-46df-bbe2-809a680cebbe::
```
<!-- export COS_ID=$(sed -n 's/^ID:[ ^t]*//p' < out | sed "s/ *//g") -->

The images will be stored in "buckets" (similar to folders in your computer).
To manage these we'll be using the Cloud Object Storage (COS) CLI and we'll
need to configure it to:
- point to our COS instance that we just created
- tell it which authentication mechanism we'll use when talking to it since it
  supports multiple types

First, let's direct all COS CLI uses to our COS instance:
```console
$ ibmcloud cos config crn --crn $COS_ID --force

Saving new Service Instance ID...
OK
Successfully stored your service instance ID.
```

Now, let's use the "IAM" authentication method which will use the same API Key
that the rest of our CLI commands will use:

```console
$ ibmcloud cos config auth --method IAM

OK
Successfully switched to IAM-based authentication. The program will access your Cloud Object Storage account using your IAM Credentials.
```

One final COS setup step is that we'll need to give our Code Engine project
permission to access our COS instance. By default, and for security reasons,
access to your COS buckets is restricted and can not be accessed by any other
cloud components without your explicit permission. In this case, we need to
authorize access to your COS bucket from your Code Engine project.

To do this we'll first need the Service Instance ID of our Code Engine project.
To get that we'll use the following command:

```console
$ ibmcloud ce project list

Getting projects...
OK

Name       ID                                    Status  Selected  Tags  Region    Resource Group  Age
thumbnail  4b9e6ea8-7d77-46a9-aa68-f65d9398a1c6  active  true            us-south  default         10m
```

And we'll need to save the `ID` value corresponding to our project. Let's
save that in an environment variable called `CE_ID`:
```console
$ export CE_ID=4b9e6ea8-7d77-46a9-aa68-f65d9398a1c6
```
<!-- export CE_ID=$(sed -n 's/^[^ ]* *\\([^ ]*\\) *active *true.*/\\1/p' < out) -->

We can now setup our authorization policy using both the `CE_ID` we just
obtained, and the Cloud Object Storage ID (`COS_ID`) from a previous command:

```console
$ ibmcloud iam authorization-policy-create codeengine cloud-object-storage \
    "Notifications Manager" --source-service-instance-id $CE_ID \
    --target-service-instance-id $COS_ID

Creating authorization policy under account 2f9dc434c476457f2c0f53244a246d34 as abc@us.ibm.com...
OK
Authorization policy ece5ed46-546c-4ea6-89a1-d2ee331f9c51 was created.

ID:                        ece5ed46-546c-4ea6-89a1-d2ee331f9c51
Source service name:       codeengine
Source service instance:   4b9e6ea8-7d77-46a9-aa68-f65d9398a1c6
Target service name:       cloud-object-storage
Target service instance:   49ceebdf-28dc-46df-bbe2-809a680cebbe
Roles:                     Notifications Manager
```

Let's save the ID of this authorization policy so we can delete it later:

```console
$ export POLICY_ID=ece5ed46-546c-4ea6-89a1-d2ee331f9c51
```
<!-- export POLICY_ID=$(sed -n 's/^ID:[ ^t]*//p' < out | sed "s/ *//g") -->

Now we can get back to setting COS up for our application. First, let's
go ahead and create a new bucket into which our data will be stored. To do
this you'll need to provide a unique name for your bucket. It needs to be
globally unique across all buckets in the IBM Cloud. In the command below
we'll use the "Source service instance" value from the previous command's
output (this just happens to also be the ID of our Code Engine project)
appended with "-thumbnail", but you can technically use any value you want as
long as it's unique. Let's save that name in an environment variable for
easy use:

```console
$ export BUCKET=4b9e6ea8-7d77-46a9-aa68-f65d9398a1c6-thumbnail
```
<!-- export BUCKET=$(sed -n 's/^Source service instance:[ ^t]*//p' < out | sed "s/ *//g")-thumbnail-$RANDOM -->

Now let's ask COS to create our bucket:

```console
$ ibmcloud cos bucket-create --bucket $BUCKET

OK
Details about bucket 4b9e6ea8-7d77-46a9-aa68-f65d9398a1c6-thumbnail:
Region: us-south
Class: Standard
```

This completes part 2 of the tutorial, so now we can continue with our
application's migration.

## Part 3 - Deploy v2 of our app

With our datastore ready, we can now deploy the second version of our
application. This version looks very similar to the first but instead of
calling the `MakeThumbnail` function immediately, it'll put the uploaded image
into our bucket. We'll invoke the `MakeThumbnail` function at a later
point in time.

As with version 1 of our application, the container image is already built for
us so we just need to tell Code Engine to use it. However, there is one other
change we need to make at the same time. This version of the application will
need to be told which bucket to use for the images. It will look for an
environment variable called `BUCKET` to get the bucket name. We could have
just hard-coded the bucket name into the application, but being able to
modify the name dynamically without changing the source code is better.

However, before the application can access the bucket it'll need a little more
information about how to talk to COS - for example, it'll need the credentials
to authenticate to our COS instance. Code Engine can help here by
settings up the credentials and auto-injecting them into the application as
environment variables. If you look in the `main` function in
[`v2/app.go`](v2/app.go) you'll see the first thing it does is get those
values for later use.

Look for the `os.Getenv("CLOUD_OBJECT_STORAGE_APIKEY")` and
`os.Getenv("CLOUD_OBJECT_STORAGE_RESOURCE_INSTANCE_ID")` calls. These will
get the API Key used to access COS, and the COS instance ID for our bucket.

In Code Engine we use the `bind` operation to connect our workloads up to
service instances - all we need is the application name and service instance
name that we used in the `resource service-instance-create` command in the
previous section, Code Engine will then inject these environment variables for
us:

```console
$ ibmcloud ce app bind --name thumbnail --service-instance thumbnail-cos

Binding service instance...
Waiting for service binding to become ready...
Status: Pending (Processing Resource)
Status: Ready
Waiting for application revision to become ready...
Traffic is not yet migrated to the latest revision.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready
OK
```

Notice that it had to deploy a new version (or "revision") of the application.
That will happen each time any change is made to an application. If the
application is in the middle of receiving requests then it will not send
new requests to the new revision until it successfully comes up and is ready.
Only then will Code Engine migrate all traffic from the old revision to the
new one. This means that users of your application will never experience any
downtime during this switch-over. Eventually the old revision of your code
will be scaled down.

Even though we haven't upgraded our application code yet, having those
COS and BUCKET environment variables already set does not harm. But, let's
now go ahead and upgrade to the latest ("v2") version of our code, and
remember to pass in the bucket name as an environment variable:

```console
$ ibmcloud ce app update --name thumbnail --image ibmcom/thumbnail:v2 \
    --env BUCKET=$BUCKET

Updating application 'thumbnail' to latest revision.
The Configuration is still working to reflect the latest desired specification.
Traffic is not yet migrated to the latest revision.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready
Run 'ibmcloud ce application get -n thumbnail' to check the application status.
OK

https://thumbnail.79gf3v2htsc.us-south.codeengine.appdomain.cloud
```

Now that that application has been updated, you might have noticed that the
webpage looks a little bit different. There are a few things to be aware of:
- Dragging (or uploading) an image into the left-most box does not upload
  it automatically to the server (object storage). You are given an
  opportunity to view it first
- Once you're ok with the image, you then can then press the "Upload Image"
  button to upload it to the object storage
- You should see the resulting image in the "Images / Thumbnails" box on the
  right. However, the corresponding thumbnail image should show "N/A" until
  you ask for the thumbnail to be generated
- Note that you can upload as many images as you want before you generate
  the thumbnails for them
- You will generate the thumbnails via the "Thumbnails Job Runner" button,
  but that hasn't been enabled yet. We'll do that next
- And finally, you'll notice a "Clear Bucket" button which can be used to
  erase the contents of the object storage bucket if you want

Technically you can use the application right now, but if you upload an
image you won't see the thumbnail because that logic has been moved out
of the webapp, as was mentioned in the previous section.

The processing of the images will now be done in a "Batch Job". Batch jobs
are pieces of code that will run once and then exit when done - unlike
applications that wait for additional work to come in via HTTP requests.
In this case we've moved the `MakeThumbnail` logic out of the webapp and
into a separate container image - which, if you're interested, you can see
by looking at [`v2/job.go`](v2/job.go). Like the other images, it's been
pre-built for you so all we need to do is create our batch job.

The arguments to the `job create` command are:
- `thumbnail-job`: the name we're assigning to the job
- `ibmcom/thumbnail-job`: the name of the pre-built container image
- `BUCKET`: the environment variable that the code will look for to get the
  name of the bucket in which the images are stored. Same as with the
  application.

```console
$ ibmcloud ce job create --name thumbnail-job --image ibmcom/thumbnail-job \
    --env BUCKET=$BUCKET

Creating job 'thumbnail-job'...
OK
```

It is important to note that the previous command just defines the job, it
doesn't actually execute it. By creating the definition of the job in advance
we can easily run it whenever we need to via a `job submit` command without
having to enter all of the parameters each time. However, in our case the
webapp will be submitting the job for us each time the user presses the
"Thumbnail Job Runner" button on the web page.

As with the application, the job will need credentials to talk to COS.
So we'll need to issue another `bind` command to ask Code Engine to
auto-inject those for us:

```console
$ ibmcloud ce job bind --name thumbnail-job --service-instance thumbnail-cos

Binding service instance...
Waiting for service binding to become ready...
Status: Pending (Processing Resource)
Status: Ready
OK
```

Now if you go back to the webpage you'll be able to generate thumbnails
for the images you upload by pressing the "Thumbnail Job Runner" button.
It'll take a second or two for the job to be started and do its work but
you should eventually see the thumbnails appear on the web page.

You've now successfully completed part 3 of the tutorial.

## Part 4 - Event-driven image processing

In this last portion of the tutorial we'll be making the final migration
to our application. As of now the application is more robust than it was
when we first started. It can save the images and thumbnails, it can
support processing images regardless of how they are put into our datastore,
and it can process the entire bucket of them at will via our batch job.
However, the batch job process is a bit too manual for our needs. We could
hook it up to a timer based invocation mechanism, and that's appropriate
for some system, but for our needs we want it to be a bit more reactive, or
"event driven".

In other words, our requirements are that we'd like to have each image
processed immediately as it is uploaded into COS. To achieve this were going
to have COS send us an event each time there is a new image uploaded into the
bucket, and then we'll process the image right away.

In order to make this happen we're going to deploy a second application to
receive those events. We could have reused the webapp application for this but
in order to have a clear separation of concerns we'll create a new one. Then
each can scale independently as needed.

Rather than using a pre-built container image, this time we're going to
leverage Code Engine's "build" feature and build it ourselves. In order to do
this there's a little bit of setup we need to do.

First, we'll need to create a place to store our newly created container
image. We're going to use IBM's Container Registry (ICR). In there we'll first
create a "namespace", which is similar to a folder on your desktop, to
place our image.

To do this all we need to do is tell it the name of our
namespace, we'll use `thumbnail-ns`:

```console
$ ibmcloud cr namespace-add thumbnail-ns

Adding namespace 'thumbnail-ns' in resource group 'default' for account John Doe's Account in registry us.icr.io...

Successfully added namespace 'thumbnail-ns'

OK
```

If you're running this tutorial outside of the United States then the location
of the ICR server will not be `us.icr.io` in the output from the previous
command. To keep things generic/easier, we'll set the `ICR` environment
variable to the location of your ICR server and use that whenever we reference
the images you're going to build in the remainder of this tutorial:

```console
$ export ICR=us.icr.io
```
<!-- export ICR=$(sed -n 's/^.*in registry \\(.*\\)\\.\\.\\.$/\\1/p' < out) -->

Next we need to create a set of credentials that our build process will use
to talk to the Registry. We'll give those credwntials a name of
`thumbnail-icr-apikey` so we can delete it later when we're done:

```console
$ ibmcloud iam api-key-create thumbnail-icr-apikey

Creating API key thumbnail-icr-apikey under 7f9dc5344476457f2c0f53244a246d44 as abc@us.ibm.com...
OK
API key thumbnail-icr-apikey was created
Successfully save API key information to apikey

Please preserve the API key! It cannot be retrieved after it's created.

ID            ApiKey-aeff919a-99e7-402a-9552-4924f7535832
Name          thumbnail-icr-apikey
Description
Created At    2021-04-04T17:16+0000
API Key       jtL0Z2ynl7RZs0U57lrWPou3xw2hnLo6D3wkORrwCbjE
Locked        false
```
<!-- export APIKEY=$(sed -n 's/^API Key[ ^t]*//p' < out | sed "s/ *//g") -->

The final setup we need to do is to tell Code Engine how to talk to
the Registry on our behalf using the API key we just created. To do this
you'll need to copy the "API Key" value (the `jtL0Z2...` string in the sample
above) from the previous output into the following command in place of the
`$APIKEY`:

```console
$ ibmcloud ce registry create --name icr --password $APIKEY --server $ICR

Creating image registry access secret 'icr'...
OK
```

Now we can actually define the build process of our new container image for
the new application. The parameters to this command are:
- `--name`: the name of the build definition we're setting up (`eventer-build`)
- `--image`: the name of the container image we're going to build
  (`$ICR/thumbnail-ns/eventer`). Notice that
  it includes the name of the ICR registry (`$ICR`), the name of the
  namespace (`thumbnail-ns`) and finally the name of the image itself
  (`eventer`)
- `--source`: the location of the git repo where our source code can be found
- `--registry-secret`: the registry access secret we just created in the
  previous command
- `--context-dir`: the location in the git repo where our code resides. If it's
  at the root of the repo then this parameter would not be necessary

With that, let's run the command to define the build process:

```console
$ ibmcloud ce build create --name eventer-build \
    --image $ICR/thumbnail-ns/eventer \
    --source https://github.com/IBM/CodeEngine \
    --registry-secret icr \
    --context-dir thumbnail/eventer

Creating build 'eventer-build'...
OK
```

Similar to the batch job we created, this command just defined how to do the
build, it didn't actually invoke it. This allows us to run it over and over
without needing to specify all of the parameters each time.

Let's invoke it via the `buildrun submit` command, passing in the name
of the build we just created. Notice we'll also use the `--wait` flag
so we can see the build output as it happens and we'll know when it's done:

```console
$ ibmcloud ce buildrun submit --build eventer-build --wait

Submitting build run 'eventer-build-run-210402-183139464'...
Waiting for build run to complete...
Build run succeeded status: 'Unknown'
Build run succeeded status: 'Unknown'
Build run succeeded status: 'Unknown'
Build run succeeded status: 'Unknown'
Build run succeeded status: 'Unknown'
Build run succeeded status: 'Unknown'
Build run succeeded status: 'Unknown'
Build run succeeded status: 'Unknown'
Build run succeeded status: 'True'
Build run completed successfully.
Run 'ibmcloud ce buildrun get -n eventer-build-run-210402-183139464' to check the build run status.
OK
```

Now we can finally deploy our new application to receive the events. You'll
notice that the command
looks very similar to the `app create` command we used for the webapp, but
there is one additional parameter (`--registry-secret`) that we need to pass-in
because the image is stored in our private ICR namespace, so Code Engine will
need credentials to access it - similar to the build process:

```console
$ ibmcloud ce app create --name eventer --image $ICR/thumbnail-ns/eventer \
    --registry-secret icr

Creating application 'eventer'...
The Configuration is still working to reflect the latest desired specification.
The Route is still working to reflect the latest desired specification.
Configuration 'eventer' is waiting for a Revision to become ready.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready
Run 'ibmcloud ce application get --name eventer' to check the application status.
OK

https://eventer.79gf3v2htsc.us-south.codeengine.appdomain.cloud
```

As you might have guessed, just like the first application and the batch job,
the "eventer" application needs credentials to talk to COS as well, we let's
"bind" it to the COS instance:

```console
$ ibmcloud ce app bind --name eventer --service-instance thumbnail-cos

Binding service instance...
Waiting for service binding to become ready...
Status: Pending (Processing Resource)
Status: Creating service binding
Status: Ready
Waiting for application revision to become ready...
Traffic is not yet migrated to the latest revision.
Ingress has not yet been reconciled.
Waiting for load balancer to be ready
OK
```

There's one last thing we need to do. We need to tell COS to send an event
to our "eventer" application each time a new image is uploaded into our
bucket. To do this we'll
create a "subscription". A subscription is simply a request to receive events
from a particular event producer - COS in this case. The parameters we pass
to the `subscription create` command are:
- `--name`: the name of the subscription
- `--bucket`: the name of the bucket that we want to watch
- `--destination`: the name of the application to which events are sent, so
  "eventer" in this case

Let's create our subscription:

```console
$ ibmcloud ce sub cos create --name coswatch --bucket $BUCKET \
    --destination eventer

Creating COS event subscription 'coswatch'...
Run 'ibmcloud ce subscription cos get -n coswatch' to check the COS event subscription status.
OK
```

While everything is hooked-up right now, you'll notice that the "Thumbnail
Job Runner" button is still visible, even though it shouldn't be needed
any more. However, instead of completely removing it from the code we allowed
for it to be conditionally visible via another environment variable called
`HIDE_BUTTON`. If it's set (to any non-empty string) then the button should
vanish from the webapp's page. Let's go ahead and update our application one
last time to see it disappear:

```console
> ibmcloud ce app update --name thumbnail --env HIDE_BUTTON=true
```

That's it. Go back to the web page, upload an image and you should see the
thumbnail automatically created without the need to press the Job Runner
button. And with that you've now completed part 4 of the tutorial.

## Part 5 - Final steps

This last part of the tutorial doesn't involve learning anything new about
Code Engine. Instead, first, we're going to demonstrate how the event-driven
thumbnail processor works even without uploading images via the webapp.

First, let's download an image to our local system by using one of the
pre-defined images from our webapp:

```console
$ curl -fs $URL/images/dog1.jpg > dog
```

Now, let's use the COS CLI to upload the image into our bucket, you'll want to
keep an eye on the webapp since it (along with the thumbnail) should
automatically appear on there as the webapp refreshes (`key` is the name
of the object in COS, and `$RANDOM` will ensure that each time the command
is called a unique key name is used):

```console
$ ibmcloud cos object-put --bucket $BUCKET --key dog$RANDOM --body dog

OK
Successfully uploaded object 'dog' to bucket '4b9e6ea8-7d77-46a9-aa68-f65d9398a1c6-thumbnail'.
```
<!-- ibmcloud cos objects --bucket $BUCKET | grep dog > /dev/null 2>&1 -->

Of course, you can still upload images from the webapp too if you'd like.
Either way, the `eventer` application will receive the event from COS and
process the image.

You can use the "Clear bucket" button on the webapp if you'd like to erase
the contents of the bucket.

### Cleaning up

And with that we can now erase all of the objects we created.

<!-- clean -->

Let's start by deleting all of Code Engine resources we created:
```console
$ ibmcloud ce sub cos delete --name coswatch --force
$ ibmcloud ce build delete --name eventer-build -force
$ ibmcloud ce app delete --name thumbnail --force
$ ibmcloud ce app delete --name eventer --force
$ ibmcloud ce job delete --name thumbnail-job -force
$ ibmcloud ce registry delete --name icr --force
```
Then the ICR namespace (and the container image we built):
```
$ ibmcloud cr namespace-rm thumbnail-ns --force
```
Delete the API key we used:
```
$ ibmcloud iam api-key-delete thumbnail-icr-apikey --force
```
Remove the authorization we setup between COS and Code Engine:
```
$ ibmcloud iam authorization-policy-delete $POLICY_ID --force
```
Delete all of the images in your bucket by first listing all of them:
```
$ ibmcloud cos objects --bucket $BUCKET
```
And then delete each one - replacing `$KEY` with the key/name of each:
```
> ibmcloud cos object-delete --bucket $BUCKET --key $KEY
```
<!-- ibmcloud cos objects --bucket $BUCKET --output json | sed -n 's/.*"Key": "\\(.*\\)",.*/\\1/p' | while read k ; do ibmcloud cos object-delete --bucket $BUCKET --key $k --force ; done -->
Delete the COS bucket:
```
$ ibmcloud cos bucket-delete --bucket $BUCKET --force
```
Delete the COS instance:
```
$ ibmcloud resource service-instance-delete thumbnail-cos --force
```
And finally, if you created the project as part of this tutorial, then you
can delete it now:
```
> ibmcloud ce project delete -n thumbnail --force --hard
```

Let's refresh our memory on what happened in this tutorial, we:
- created an internet facing application with just a reference to a
  container image. While we didn't demonstrate it, if the load on the
  application increased, Code Engine would have scaled it up and down
  automatically, including down to zero if it was idle.
- created an instance of COS and a bucket to store the images
- updated the application to a second version with no downtime, and made it
  so the application stored the images, and thumbnails, in the bucket
- created a batch job to process all of the images in the bucket on demand
- created a second application to react to events from COS so that we can
  process the images immediately as they're uploaded to COS instead of waiting
  for the batch job to run
- created a "build" that built this second application from our git repo for
  us

We hope you found this quick tutorial informative and if you want to learn
more about Code Engine please visit our
[web site](https://ibm.com/cloud/code-engine).
