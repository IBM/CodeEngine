# Trusted Profiles

In the IBM Cloud, when authenticating with other services such as Cloud
Object Storage or Secrets Manager, using trusted profiles is a way to
authenticate without any API keys being used. This eliminates the risk of
those being leaked or stolen by a malicious user who uses them to access your
IBM Cloud resources.

You can read more about trusted profiles in the
[IBM Cloud documentation](https://cloud.ibm.com/docs/account?topic=account-create-trusted-profile).

The samples in this directory show how to use the trusted profile in your code
using the IBM Cloud SDK that exists for Go, Java, Node, and Python.

If you are using a different programming language, then you can still use
trusted profiles, but must implement the interaction with
[IAM to retrieve an access token for a compute resource token](https://cloud.ibm.com/apidocs/iam-identity-token-api#gettoken-crtoken)
yourself.

Each of the samples then uses the token to list the files in a Cloud Object
Storage bucket.

Following are the steps to run the sample. Please note that the sample
requires account permissions to create various resources including those
related to IAM permissions.

## Setup

To setup the example, you need three things:

1. A Code Engine project
2. A Cloud Object Storage bucket
3. A trusted profile that grants access to the Cloud Object Storage bucket

### Creating a Code Engine project

We are using the command line interface here to setup things. If you have not
used it before, you can directly run it through the
[IBM Cloud shell](https://cloud.ibm.com/shell).

When running locally, make sure the necessary plugin is installed:

```sh
ibmcloud plugin install code-engine
```

In the IBM Cloud shell, the plugin is already installed, however it makes
sense to ensure the latest version is installed:

```sh
ibmcloud plugin update --all --force
```

Then you are ready to create a Code Engine project. Here and in the following
snippets, variables will be used. Feel free to adjust them to your needs, but
make sure that you use the same value for the same variable in all snippets.

```sh
REGION=eu-es
RESOURCE_GROUP=Default
CE_PROJECT_NAME=trusted-profiles-test

ibmcloud target -r ${REGION} -g ${RESOURCE_GROUP}
ibmcloud ce project create --name ${CE_PROJECT_NAME}
```

### Creating a Cloud Object Storage bucket

For this sample, you can use an existing Cloud Object Storage bucket that
you already have. If you never used COS, then here is a one-sentence
introduction: Cloud Object Storage is a managed data service where you can
store data in files.

With the following commands, you will setup your first COS instance and a
bucket. First, make sure the CLI plugin is installed:

```sh
ibmcloud plugin install cos
```

The COS bucket uses a random suffix (`31292`) because bucket names must
be unique across all IBM Cloud customers in a region. Make sure you use
your own random characters.

```sh
REGION=eu-es
RESOURCE_GROUP=Default
COS_INSTANCE_NAME=my-first-cos
COS_BUCKET=my-first-bucket-31292

ibmcloud resource service-instance-create ${COS_INSTANCE_NAME} cloud-object-storage standard global -g ${RESOURCE_GROUP} -d premium-global-deployment-iam
COS_INSTANCE_ID=$(ibmcloud resource service-instance ${COS_INSTANCE_NAME} --crn 2>/dev/null | grep ':cloud-object-storage:')
ibmcloud cos config crn --crn ${COS_INSTANCE_ID} --force
ibmcloud cos bucket-create --bucket ${COS_BUCKET} --class smart --ibm-service-instance-id ${COS_INSTANCE_ID} --region ${REGION}
```

To have content in the bucket, let's store a sample text file:

```sh
echo Hello World >helloworld.txt
ibmcloud cos object-put --region ${REGION} --bucket ${COS_BUCKET} --key helloworld.txt --body helloworld.txt
```

### Creating a trusted profile that grants a Code Engine Job access to your COS bucket

In this step, we are creating a Trusted Profile which grants read access to
your COS bucket to a Job called `list-cos-files` in your Code Engine project.

The Job itself, we will create later.

```sh
REGION=eu-es
RESOURCE_GROUP=Default
COS_INSTANCE_NAME=my-first-cos
COS_BUCKET=my-first-bucket-31292
CE_PROJECT_NAME=trusted-profiles-test
JOB_NAME=list-cos-files
TRUSTED_PROFILE_NAME=code-engine-cos-access

CE_PROJECT_CRN=$(ibmcloud resource service-instance ${CE_PROJECT_NAME} --location ${REGION} -g ${RESOURCE_GROUP} --crn 2>/dev/null | grep ':codeengine:')
COS_INSTANCE_ID=$(ibmcloud resource service-instance ${COS_INSTANCE_NAME} --crn 2>/dev/null | grep ':cloud-object-storage:')

ibmcloud iam trusted-profile-create ${TRUSTED_PROFILE_NAME}
ibmcloud iam trusted-profile-link-create ${TRUSTED_PROFILE_NAME} --name ce-job-${JOB_NAME} --cr-type CE --link-crn ${CE_PROJECT_CRN} --link-component-type job --link-component-name ${JOB_NAME}
ibmcloud iam trusted-profile-policy-create ${TRUSTED_PROFILE_NAME} --roles "Content Reader" --service-name cloud-object-storage --service-instance ${COS_INSTANCE_ID} --resource-type bucket --resource ${COS_BUCKET}
```

## Running the sample

To run the sample, we will now create the Code Engine Job pointing to the
sources in this repository. Feel free to use `go`, `java`, `node` or
`python` as value for the `PROGRAMMING_LANGUAGE` variable.

```sh
REGION=eu-es
COS_BUCKET=my-first-bucket-31292
JOB_NAME=list-cos-files
PROGRAMMING_LANGUAGE=node
TRUSTED_PROFILE_NAME=code-engine-cos-access

ibmcloud ce job create --name ${JOB_NAME} \
  --build-source https://github.com/IBM/CodeEngine \
  --build-context-dir trusted-profiles/${PROGRAMMING_LANGUAGE} \
  --trusted-profiles-enabled=true \
  --env COS_REGION=${REGION} \
  --env COS_BUCKET=${COS_BUCKET} \
  --env TRUSTED_PROFILE_NAME=${TRUSTED_PROFILE_NAME}
```

Code Engine will setup the Job and as part of that runs a build of the chosen
source. The output is a container image that it pushes to a Container Registry
namespace that it creates for your project. Once that completed, your Job is
ready to be run:

```sh
JOB_NAME=list-cos-files

ibmcloud ce jobrun submit --job ${JOB_NAME} --name ${JOB_NAME}-run-1
ibmcloud ce jobrun logs --name ${JOB_NAME}-run-1 --follow
```

If everything has been setup correctly, the JobRun logs will show the number
of items it found and their keys, in case you set up the sample bucket above,
then it will be just one item called helloworld.txt.

## Code Review

All of the four samples use the language-specific IBM Cloud SDK. Those define
an `Authenticator` interface and provide the `ContainerAuthenticator`
implementation. When instantiating the `ContainerAuthenticator`, you must
provide the identifier or name of trusted profile. The sample job from above
uses the name which is defined as `TRUSTED_PROFILE_NAME` environment variable
on the Code Engine Job.

The `Authenticator` has an `authenticate` method that augments an existing
HTTP request object with the necessary `Authorization` header. Under the
covers, the `ContainerAuthenticator` for that purpose reaches out to
[IAM to retrieve an access token for a compute resource token](https://cloud.ibm.com/apidocs/iam-identity-token-api#gettoken-crtoken).

The `ContainerAuthenticator` will also automatically manage the refresh of the
token.

The sample code authenticates a request against the Cloud Object Storage API
to list the items in a bucket. The response is parsed and printed.
