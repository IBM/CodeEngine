# Cloudant-Change-Listener


## Intention
This quick-start daemon job sample is a fully runable basic implementation of a cloudant database change listener long running process. The main feature of the job is to react on each db document change with an invocation of a Code Engine Function or Code Engine Application. 


__HINT__: Customers used "Cloudant Trigger" capability in IBM Cloud Functions may use this daemon job as a cloudant trigger migration solution. 

The instruction below describes how to create and run the Cloudant-Change-Listener daemon job using the IBM Cloud UI in an existing IBM Code Engine project. A full end-to-end example with a  Cloudant-Change-Listener connected to a cloudant sample database and invoking a sample Code Engine function is available as "run" script. The script includes the creation and execution of the daemon job as well as the setup of a sample cloudant db with document changes. 

- - -
## Architecture: 

The Cloudant-Change-Listener is implemented as a Code Engine daemon job because only daemon jobs runsforever and can hold endless database connections using the IBM cloudant SDK API. 
Parallel running instances of the Cloudant-Change-Listener job is supresssed because IBM cloudant SDK would send change notification to each listener connection.

![Architecture Diagram](images/Architecture.png)


## Let's Get Started
 
This sample job is a fully runable Cloudant-Change-Listener. It can be used "as-is" if the db listening solution requires:  
   - continously listening on exact __ONE__ cloudant database for __EACH__ document create, change and delete  
   - an invocation of a Code Engine Function or Code Engine Application as result of each detected db change 
   - no suppression of duplicate change notifications across restarts of the job 

HINT: The sample code contains "Customer TODO" sections where the job can be improved to fulfill further sollution requirements. 

It is recommended to clone the cloudant-change-lister sample from the GIT repository at first and work with the copy. 


## Pre-conditions

This chapter describes the mandatory and optional tasks before the Cloudant-Change-Listener job can be created and started. The pre-condition tasks are used to collect and set all necessary startup parameters (as environment variables) for the  job.

### Creation of config map 

The name of the config map must follow the rule :  "\<job_name\>-config" 
and has to contain the key/value pair: "DB_LAST_SEQ" : "now"

Step by step see https://cloud.ibm.com/docs/codeengine?topic=codeengine-configmap#configmap-create

Although the job is designed as long running job there is the need to consider the "stop and restart" scenario ( e.g in case of version upgrade or maintenance). That scenario results in a short outage where no database changes received. To ensure that no change get lost the job saves the "DB_LAST_SEQ" last change identifier while stopping to a config map assigned to the CE Project. On restart the DB_LAST_SEQ" will be read and used as start listening identifier while opening a new DB listening connection.

### Creation of ServiceID (apiKey) 

The Cloudant-Change-Listener job needs access permission to the hosting Code Engine Project to control that job is running only once. Therefore a serviceID access with API_KEY must be created for the : 
  - service  : "Code Engine" 
  - Resource : "\<CE-Project-name-where-Job-resides\>"

Step by step see: https://cloud.ibm.com/docs/account?topic=account-serviceids&interface=ui#create_serviceid

==> Use the value of the generated API KEY for the Job's env var CE_API_KEY 


### Get URL of a Code Engine Function or Code Engine Application 

The public endpoint URL of an existing or newly created Code Engine Function (or app) must be retrieved to provide as startup parameter for the Cloudant-Change-Listener app. The endpoint must accept the input parms containing the db change notification details to identify the db document. Additionally the cloudant database's service binding should be attached to the CE Function (or app), so that the db can be connected from the function, too. 

Step by step:
  - Retrieve the Code Engine Function's endpoint URL in UI by calling the "application-URL" in the "test function" dialog of the UI page  " => Code Engine => Projekte => "\<CE-Project-name-where-Function-resides\>" => "\<function-name\>".

  - Retrieve the Code Engine Application's endpoint URL in UI by calling the "functions-URL" in the "test applicaiton" dialog of the UI page  " => Code Engine => Projekte => "\<CE-Project-name-where-Application-resides\>" => "\<application-name\>".

HINT: The source code for a sample function can be found in the folder "./function" of this sample package. 

==> Use the value of the generated API KEY for the Job's env var CE_TARGET 

### Retrieve Project ID of hosting project

The daemon job has to know the hosting project ID to be able to ensure that only one Job Instance of it is running. 

Step by step:
  - Retrieve the project ID in UI by reading the GUID value of the project in the "Details" dialog of the " => Code Engine => Projekte => "\<CE-Project-name-where-Application-resides\>" page

==> Use the retrieved project ID (GUID) for the Job's env var CE_PROJECT_ID


### Get cloudant DB info

This sample requires that there is an IBM cloud cloudant DB instance with a service credential and IAM Authentication from which the neccessary values for the job startup can be retrieved. 

The cloudant-change-listener job must establish a DB connection to the customer's DB. Therefore the following DB settings must be retrieved from the DB instance's service credential: 

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

## Creation of the Cloudant-Change-Listener job 

The job must be created as daemon job with job index = 0 (the default). 

Create the daemon job following the steps : https://cloud.ibm.com/docs/codeengine?topic=codeengine-job-daemon
by using the same project_name and job_name as above. 
 - As source code location select the ssh git URL of the cloned repository. ( Atttention: A valid ssh key pair must be registered on GIT repo and in the Job's source location definition )
 - Select the branch of the repository 
 - Provide the foldername ( "cloudant-change-listener") as context if folder structur in own repository is not changed after cloning. 
 - Provide the environment variables with the key/value pairs from above. 
 - Add a environment variable as "full reference to the configmap" and select the configmap created above 



## Running Cloudant-Change-Listener job instance 

A job instance can be started on the "Job"s overview page" with the button "Submit job" dialog of the UI page  " => Code Engine => Projekte => "\<CE-Project-name-where-job-resides\>" => "\<job-name\>".

On the Job Instances page the job will appear as active. 
By selecting the "logging" link the log service can be started for this job and the job's output can be observed on the logging page. 



### Stop and restart of the job  

Stopping and starting can be done on the "Job"s overview page",too. 

- To stop a running Job select the active job instance and use the "delete job instance" button.
- To start a new job instance use the "submit button" again. The start of a new job instance will only be successful if the previous running job has completely finished.  ( only 1 instance rule )

see also : https://cloud.ibm.com/docs/codeengine?topic=codeengine-job-plan


### Testing the Job 

The cloudant-change-listener job is immediately starting the listening DB connection on start. So when it appears as active in the job instances list, then it is fully working. 

Customer can test the job by adding,changing or deleting any document in the cloudant database which is reference in the startup env vars of the job. 

Verification of successful handling of a doc change can be done in the activated logging page or by the output of the customer's Code Engine Function ( or app ). 

The quick-start sample is runnable but not fully production ready. The sample code includes "Customer TODO" sections where a customer may enhance the sample to get a version usable in production.


