# Cloudant-Change-Listener


## Intention
This quick start daemon job sample is a basic implementation of a Cloudant database change listener that runs indefinitely. The main purpose of the job is to react to each DB document change with an invocation of a Code Engine Function or Code Engine Application. 


__HINT__: Customers used "Cloudant Trigger" capability in IBM Cloud Functions may use this daemon job as a cloudant trigger migration solution. 

These instructions describe how to create and run the Cloudant-Change-Listener daemon job by using the IBM Cloud UI in an existing IBM Code Engine project. A full end-to-end example with a Cloudant-Change-Listener that is connected to a Cloudant sample database and invokes a sample Code Engine function is available as "run" script. The script includes creating and running of the daemon job as well as the setup of a sample Cloudant DB with document changes. 

- - -
## Architecture: 

The Cloudant-Change-Listener is implemented as a Code Engine daemon job because a daemon jobs runs indefinitely and can hold endless database connections by using the IBM Cloudant SDK API. 
You cannot run the Cloudant-Change-Listener job in parallel running instances because IBM cloudant SDK would send change notification to each listener connection.

![Architecture Diagram](images/Architecture.png)


## Getting started
 
This sample job is a Cloudant-Change-Listener. It can be used "as-is" if the DB listening solution requires:  
   - Continously listening on exact __ONE__ cloudant database for __EACH__ document create, change, and delete. 
   - An invocation of a Code Engine Function or Code Engine Application as result of each detected db change.
   - No suppression of duplicate change notifications across restarts of the job.

HINT: The sample code contains "Customer TODO" sections where the job can be improved to fulfill further solution requirements. 

It is recommended that you clone the cloudant-change-lister sample from the GIT repository at first and work with the copy. 


## Prerequisites

This section describes the mandatory and optional tasks before you create the Cloudant-Change-Listener job. The pre-condition tasks are used to collect and set all necessary startup parameters (as environment variables) for the  job.

### Creating the configmap 

The name of the configmap must follow the rule :  "\<job_name\>-config" 
and has to contain the key/value pair: "DB_LAST_SEQ" : "now"

For more information about creating a configmap, see https://cloud.ibm.com/docs/codeengine?topic=codeengine-configmap#configmap-create.

Although the job is designed to run indefinitely, you must consider the "stop and restart" scenario (e.g in case of version upgrade or maintenance). That scenario can results in a short outage where no database changes are received. To ensure that changes do not get lost, the job saves the "DB_LAST_SEQ" last change identifier to a configmap assigned to the CE Project whenever it is stopped. On restart, the DB_LAST_SEQ" is read and used as a start listening identifier while opening a new DB listening connection.

### Creating the Service ID (apiKey) 

The Cloudant-Change-Listener job requires access permission to the hosting Code Engine Project to ensure that only a single instance of the job is running. Therefore, a service ID with an API_KEY must be created for the following : 
  - service  : "Code Engine" 
  - Resource : "\<CE-Project-name-where-Job-resides\>"

For more information about creating a service ID< see https://cloud.ibm.com/docs/account?topic=account-serviceids&interface=ui#create_serviceid.

==> Use the value of the generated API KEY for the Job's env var CE_API_KEY 


### Getting the URL of a Code Engine Function or Code Engine Application 

The public endpoint URL of an existing or newly-created Code Engine Function (or app) must be retrieved to provide as startup parameter for the Cloudant-Change-Listener app. The endpoint must accept the input parameters that contain the DB change notification details to identify the DB document. Additionally, the Cloudant database's service binding must be attached to the CE Function (or app) so that the DB can be connected from the function, too. 

Follow these steps.
1. Retrieve the Code Engine Function's public URL from the  "Details" page for the function in the UI. Go to " => Code Engine => Projects => "\<CE-Project-name-where-Function-resides\>" => "\<function-name\>". Then, select "Domain mappings".

2. Retrieve the Code Engine Application's public URL from the  "Details" page for the application in UI. Go to " => Code Engine => Projekte => "\<CE-Project-name-where-Application-resides\>" => "\<application-name\>". Then, select "Domain mappings".

HINT: The source code for a sample function can be found in the folder "./function" of this sample package. 

==> Use the value of the generated API KEY for the Job's env var CE_TARGET 

### Retrieving the Project ID of project

You must provide the project ID to the daemon job to ensure that only one instance of the job is running. 

Follow these steps:
  - Retrieve the project ID in UI by reading the GUID value of the project in the "Details" dialog. Go to " => Code Engine => Projecte => "\<CE-Project-name-where-Application-resides\>".

==> Use the retrieved project ID (GUID) for the Job's env var CE_PROJECT_ID


### Retrieving the Cloudant DB information

This sample requires an IBM Cloud Cloudant DB instance with a service credential and IAM Authentication from which the neccessary values for the job startup can be retrieved. 

The cloudant-change-listener job must establish a DB connection to the customer's DB. Therefore, the following DB settings must be retrieved from the DB instance's service credential: 

- DB Host URL  ( e.g 33286a6c-ad3e-4d11-909b-e67df631a310-bluemix.cloudantnosqldb.appdomain.cloud)
- DB Host Port  ( default is : 443)
- DB Name 
- DB ApiKey  (or DB Username/password)

==> Use the retrieved values for the Job's env vars: 
        - CE_DB_HOST : \<db host name>
        - CE_DB_PORT : \<port used by DB host> ( default is 443)
        - CE_DB_NAME : \<db name >
        - CE_DB_API_KEY : \<api key of DB is IAM Authentication used by DB>
        - (Alternative to API Key) CE_DB_USERNAME : \< db user name>
        - (Alternative to API Key) CE_DB_PASSWORD : \< db password>
        
````
HINT: Instead of copying the DB settings from the service credential into the environment variable it is possible to use it by service binding. (see: https://cloud.ibm.com/docs/codeengine?topic=codeengine-bind-services). The Cloudant DB service binding to CE Job can only be done after the job creation. 
````

## Creating the Cloudant-Change-Listener job 

The job must be created as daemon job with job index = 0 (the default). 

Create the daemon job with the same project_name and job_name previously listed by following these steps: https://cloud.ibm.com/docs/codeengine?topic=codeengine-job-daemon.

 - As source code location, select the SSH GIT URL of the cloned repository. (Atttention: A valid SSH key pair must be registered on GIT repo and in the job's source location definition )
 - Select the branch of the repository.
 - Provide the foldername ( "cloudant-change-listener") as context if folder structur in own repository is not changed after cloning. 
 - Provide the environment variables with the key/value pairs that you created previously. 
 - Add a environment variable as "full reference to the configmap" and select the configmap that you created previously.



## Running Cloudant-Change-Listener job instance 

Start a job instance from the job "Overview page" by clicking "Submit job" from the UI. Go to  " => Code Engine => Projecte => "\<CE-Project-name-where-job-resides\>" => "\<job-name\>".

On the Job Instances page, the job appears as active. 
By selecting the "logging" link, you can start the log service for this job and you can observe the job's output on the logging page. 

### Stopping and restarting of the job  

You can start and stop the job from the job "Overview page".

- To stop a running job, select the active job instance and click the "Delete job instance".
- To start a new job instance, click "Submit" again. The new job instance starts only if the previously running job has completely finished.  (only 1 instance rule)

For more information, seed: https://cloud.ibm.com/docs/codeengine?topic=codeengine-job-plan.

### Testing the job 

The cloudant-change-listener job is immediately starts the listening DB connection. When it appears as active in the job instances list, then it is fully working. 

You can test the job by adding, changing, or deleting any document in the target Cloudant database.

To verify that the doc change was recorded successfully, check the activated logging page or the output of your Code Engine Function (or app). 

While the quick start sample is runnable as-is, it is not fully production ready. The sample code includes "Customer TODO" sections, where you can enhance the sample to create a version that you can use in production.