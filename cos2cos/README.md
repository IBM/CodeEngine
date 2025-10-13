# COS to COS Processing System

This repository contains a Go-based application that processes objects (files) in IBM Cloud Object Storage (COS) between a primary and secondary bucket. The system is designed for flexibility, scalability, and ease of use, allowing users to configure the processing logic based on their needs. The program leverages Go routines and IBM Code Engine jobs to implement parallel processing for better performance.

## Overview

The **COS to COS Processing System** performs the following tasks:

1. **Fetch Objects**: It fetches updated objects from a primary bucket.
2. **Process Objects**: It performs a user-defined processing function (e.g., converting lowercase text to uppercase).
3. **Update Secondary Bucket**: It uploads the processed objects to the secondary bucket.
4. **Optimized Processing**: Only objects modified or created after the last processing cycle are processed.
5. **Parallel Processing**: It uses Go-routines and IBM Code Engine Jobs to process multiple files concurrently.

The program uses IBM Cloud’s SDK to access COS and provides options for authentication using either trusted profiles.

## Features

- **User-Defined Processing**: The processing logic can be customized. By default, it converts all lowercase text in a file to uppercase, but this can be modified based on user requirements.
- **Efficient File Handling**: It only processes files that have been modified or created since the last run.
- **Parallel Processing**: Utilizes Go-routines and IBM Code Engine Jobs to process large files concurrently. Jobs are distributed based on a defined `array_size`.
- **Configurable**: Users can configure the system via environment variables for bucket names, region, and other settings.
- **Testing**: Unit tests are provided using Ginkgo and the Testify mock package.
- **Deployment on IBM Cloud**: The application is containerized and can be deployed using IBM Code Engine.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following:

- **IBM Cloud CLI**: For managing IBM services. Refer [Getting started with the IBM Cloud CLI](https://cloud.ibm.com/docs/cli?topic=cli-getting-started)
- **IBM Plugins**(Refer [Step 3](#setup--configuration)): Verify that below plugins are installed:
   1. ce
   2. cos
   3. iam
- **Podman** or **Docker**(Refer, [Build Steps](#build-steps)): For building the container.
- **IBM Cloud Object Storage (COS)**(Not required when using config.sh script): Ensure you have created two buckets (primary and secondary). Refer, [Getting started with IBM Cloud Object Storage](https://cloud.ibm.com/docs/cloud-object-storage?topic=cloud-object-storage-getting-started-cloud-object-storage).
- **IBM Code Engine**(Not required when using config.sh script): Set up and create a project on IBM Code Engine. Refer, [Getting started with IBM Cloud Code Engine](https://cloud.ibm.com/docs/codeengine?topic=codeengine-getting-started).
- **Go**: For modifying and testing the source code.

### Setup & Configuration
1. **Clone the Repository**:
   ```bash
   git clone https://github.ibm.com/ibmcloud-codeengine-internship/code-engine-cos2cos
   cd code-engine-cos2cos
   ```
2. **Modify the Processing Function (Optional)**:
   
   If you want to modify the processing logic, update the `UserDefinedProcessObjectBytes` function in `userDefinedProcess/processObject.go` with your desired functionality.
3. **Installing necessary plugins required for running the build image**
   
   To learn more: [Extending IBM Cloud CLI with plug-ins](https://cloud.ibm.com/docs/cli?topic=cli-plug-ins).
   ```bash
   ibmcloud plugin install ce cos iam
   ```
4. **Update [data.sh](/data.sh)**:
   
   Please update the variable values in the file as per your requirement. The details for creating the cos2cos job with config.sh and building image with build.sh is fetched from this file. 
   
   Note:- The variable CRTokenFilePath should remain same as mentioned in the data.sh file.
5. **Build the Image from the source code**:
   Refer [Build Steps](#build-steps)
6. **Setup the required IBM Cloud resources**:
   
   To automatically set up the required IBM Cloud resources, including COS buckets and secrets, simply run the provided `config.sh` script:

   ```bash
   ./config.sh
   ```
   This script will do the following:
   - Create the **primary** and **secondary** buckets in IBM Cloud Object Storage (if not already created).
   - Generate and inject secrets for base configuration and authentication into IBM Cloud UI.
   - Set up a **Code Engine** Job with the necessary secrets and configurations, including automatic environment variable injection.
   - Once you run the config.sh, the job is created and then you need to manually run it on IBM Cloud Code-Engine  using UI or CLI. Refer Step 7.
  
   Note:
   - The script will either take the existing project with the project name provided in data.sh or create a new project with the same name.
   - The script will create a trusted profile if it does not exists. 
   - The script will work only with authentication mechanism of Trusted Profile. In-case the user wants to use service-credentials then he/she needs to manually update the AUTH_SECRET and create the API_KEY for both COS Instance as well as add second command-line argument as "false". The first argument can be set to "true" or "false". See below for more.
   - The two command line arguments are:
      1. The first argument "isInCodeEngine", a boolean value, is set to true by-default (meaning the job is running in IBM Cloud Code-Engine). It can be set to "false" when the user wants to run it locally.
      2. The second argument "isUsingTrustedProfile", a boolean value, is set to true by-default (meaning authentication mechanism for COS bucket is TrustedProfile). It can be set to "false" when the user wants to use service-credentials. Please make sure that the AUTH_SECRET is also updated to have the following (in-case using service-credentials):
         ```bash
         IBM_COS_API_KEY_PRIMARY=<COS-API-KEY-Primary>
         IBM_COS_API_KEY_SECONDARY=<COS-API-KEY-Secondary>
         ```
   - IMP: TrustedProfile Authentication method won't work when running the program locally.
7. **Run the Program**:
   Once everything is configured, run it
   
   - Locally using
      ```bash
      go run .
      ```
   OR
   - On IBM Cloud Code-Engine using CLI:
      ```bash
      ibmcloud ce jobrun submit --job ${JOB_NAME} --name ${JOB_NAME} 
      ```


   This will:
   - Trigger the job in **IBM Code Engine** to process the files in the primary bucket.
   - Upload the processed files to the secondary bucket.

   Note:
   - If you are running the program locally, pass 2 command-line arguments "false" "false" while running main.go
   - Also make sure that env file is configured accordingly.
8. **Check the Logs**:
   After the job completes, check the IBM Cloud UI or the logs to confirm the processing status.

## Run as Parallel Jobs
The system supports parallel execution using IBM Code Engine Job arrays. This enables multiple job instances to run in parallel, each processing a distinct subset of files. It improves performance and scalability, especially for large data sets or high file counts.

A sample version of the parallel job setup is included in the repository:
https://github.ibm.com/Hamza/Sample-Running-Jobs-in-Parallel

## Environment Setup

To run the project locally, you need to create a `.env` file in the root directory. You can refer to the [`env_sample`](/env_sample) file for the required environment variables and their format.

## Testing

The project includes unit tests using **Ginkgo** and **Testify**. You can run the tests locally to verify the functionality of the core processing logic.

To run the tests:
```bash
go test -v
```

## Build Steps

You can build and push the container image using one of the following methods.

**Note**: If you are using the [build.sh](/build.sh), by-default the [Method-2](#2-build-using-source-code-local-source) is used.

#### 1. Build Using Podman (Local Source)

If you want to build the container image using a local `Dockerfile` with Podman, follow these steps:

```bash
ibmcloud cr login
podman build -t ${REGISTRY}/${NAMESPACE}/${IMAGE_NAME} --platform linux/amd64 .
podman push ${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}
```

#### 2. Build Using Source Code (Local Source)

To build the image from local source code using IBM Cloud Code Engine:

```bash
ibmcloud ce build create --name ${BUILD_NAME} --build-type local --image ${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}
ibmcloud ce buildrun submit --build ${BUILD_NAME} --name ${BUILD_NAME}-build-run
```

#### 3. Build Using Git-based Source

To build the image using a Git repository:

1. Create a deploy key or user-access key in your GitHub repository.
2. Add the private key by creating an SSH secret in IBM Cloud Code Engine.
3. Create a build using the Git repository:

```bash
ibmcloud ce build create \
    --name ${BUILD_NAME} \
    --image ${REGISTRY}/${NAMESPACE}/${IMAGE_NAME} \
    --source ${GIT_SSH_URL} \
    --context-dir / \
    --strategy dockerfile \
    --git-repo-secret ${GIT_SSH_SECRET}
```

4. Submit the build:

```bash
ibmcloud ce buildrun submit --build ${BUILD_NAME}
```

### View Build Logs

To view the logs of a build run, use the following command:

```bash
ibmcloud ce buildrun logs -f -n <build-run-name>
```

Replace `<build-run-name>` with the actual name of your build run.

## Performance

The program is optimized for handling large files (up to several GBs). For example, when tested with 50 files (each 65MB), the program processed the files in 70 to 100 seconds, with 13 parallel jobs.

## Troubleshooting

- **Error: Object Not Found**: Ensure that the primary bucket is correctly configured and contains the objects you expect.
- **Authentication Failure**: Check that the authentication method (trusted profile or service credentials) is correctly set up.
- **Job Timeout or Failure**: If the job takes longer than expected, check the logs for any performance bottlenecks or errors.
