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

- **IBM Cloud Object Storage (COS)**(Not required when using config.sh script): Ensure you have created two buckets (primary and secondary). Refer, [Getting started with IBM Cloud Object Storage](https://cloud.ibm.com/docs/cloud-object-storage?topic=cloud-object-storage-getting-started-cloud-object-storage).
- **IBM Code Engine Project**(Not required when using config.sh script): Set up and create a project on IBM Code Engine. Refer, [Getting started with IBM Cloud Code Engine](https://cloud.ibm.com/docs/codeengine?topic=codeengine-getting-started).
- **Go**: For modifying and testing the source code.

### Setup & Configuration
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/IBM/CodeEngine.git
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
   
   Please update the variable values in the file as per your requirement. The details for creating the cos2cos job with config.sh is fetched from this file. 
   
5. **Build the Image from the source code**:
   
   Image build is done automatically in the config.sh file from source.
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
7. **Run the Program**:
   Once everything is configured, run it
   - On IBM Cloud Code-Engine using CLI:
      ```bash
      ibmcloud ce jobrun submit --job ${JOB_NAME} --name ${JOB_NAME} 
      ```

   This will:
   - Trigger the job in **IBM Code Engine** to process the files in the primary bucket.
   - Upload the processed files to the secondary bucket.

8. **Check the Logs**:
   After the job completes, check the IBM Cloud UI or the logs to confirm the processing status.

## Run as Parallel Jobs
The system supports parallel execution using IBM Code Engine Job arrays. This enables multiple job instances to run in parallel, each processing a distinct subset of files. It improves performance and scalability, especially for large data sets or high file counts.

A sample version of the parallel job setup is included in the repository:
https://github.ibm.com/Hamza/Sample-Running-Jobs-in-Parallel


## Testing

The project includes unit tests using **Ginkgo** and **Testify**. You can run the tests locally to verify the functionality of the core processing logic.

To run the tests:
```bash
go test -v
```

## Performance

The program is optimized for handling large files (up to several GBs). For example, when tested with 50 files (each 65MB), the program processed the files in 70 to 100 seconds, with 13 parallel jobs.

## Troubleshooting

- **Error: Object Not Found**: Ensure that the primary bucket is correctly configured and contains the objects you expect.
- **Authentication Failure**: Check that the authentication method (trusted profile) is correctly set up.
- **Job Timeout or Failure**: If the job takes longer than expected, check the logs for any performance bottlenecks or errors.
