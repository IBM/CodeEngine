# IBM MQ Observer
The observer monitors queue depths and sends notifications to registered applications when the monitored queue has a depth of greater than 0. 

For detailed description of the implementation see [implementaton deep dive](DEEPDIVE.md)

## High level overview
Applications and jobs are registered to be notified when queues on queue managers contain messages. The observer montiors those queues, and sends notifications to the registered applications and jobs.
Optionally a Cloud Object Storage bucket is used to persist registrations.

## Seed Registrations
The observer keeps a register of jobs and applications to be notified. This register is dynamic, ie. it can be updated after the observer is started, but can be seeded at startup. If the applications and jobs that need to be registered are known you can seed the data and provide it in one of two ways. 
- Place it in the bucket in cloud object storage, specifying the bucket name and object key in the [env.json](observer/env.json) file, which can be overriden by environment variables.
- Pass it in as the envrionment variable `seeddata`. eg.

```
seeddata='{"mq_requests": [{"id": "5c41bc76-a193-41af-90ea-cd4f031ce9ca","qmgr": "QM1","queue": "DEV.QUEUE.2", "notify": "ce-mq-consumer"}]}'  ./observer
```

The included file [seeddata](observer/resources/seeddata) shows the format for seed data.

If you are running the observer in Code Engine, environment variables are provided as secrets and configmaps. 


## Deploying to Code Engine
A `Dockerfile` is provided letting you run the observer in a container. The observer need not be run as a Code Engine application, and can be run anywhere. The jobs and applications it notifies can still be code engine jobs and applications. The observer needs to be continuously running to check on queue depths and send the relevent notifications. 

If do want to run the observer in Code Engine, we have provided a sample script which you can customise. We recommend placing as many environment variables as you can in the [env.json](observer/env.json) file, and only overriding credentials as secrets, and the seed data in a configmap. Use the provided [env.json](observer/env.json) to provide Queue Manager, Code Engine and optional Cloud Object Storage configuration details.

The sample script also creates a sample consumer as a job definition. The seeddata registers the job twice for notifications on `QM1 / DEV.QUEUE.1` and `QM2 / DEV.QUEUE.2` respectively. It uses the full IBM MQ MQI Go client to pull messages off queues. The keys directory has been populated with a keystore containing the public key of signing authority for the IBM Cloud IBM MQ service.

You will need to [install the ibmcloud cli and ce plugin](https://cloud.ibm.com/docs/cli?topic=cli-install-ibmcloud-cli). Alternatively, You can use the Code Engine user interface to register secrets, configmaps and create the application.

### Steps
1. Login to the cloud
```
ibmcloud login --apikey <IBMCLOUD_API_KEY> -r <REGION_OF_CE_PROJECT> -g <RESOURCE_GROUP>
```
2. Set the code engine project
```
ibmcloud ce project select --name <CE_PROJECT_NAME>
```
3. Set environment variables:
- *cos_apikey*  Cloud Object Storage Key (Optional)
- *ce_apikey*   Code Engine Key
- *ADMIN_USER*  MQ Admin User
- *ADMIN_PASSWORD*  MQ Admin Password
- *APP_USER*  MQ App User for the sample consumer job
- *APP_PASSWORD*  MQ App Password for the sample consumer job

4. Deploy to code engine
```
./deploy.sh
```

### Remove from Code Engine
To remove the application and associated secrets and configmap run
```
./deploy.sh clean
```

### Creating new registrations
If you have the observer running on host `observer-host` listening on port 8080, then you can register an application as a form, setting `QMGR`, `QUEUE` and `NOTIFY`.

`NOTIFY` should be set to a url that your application is exposing and expecting notifications on, or a code engine job name. 
If your application is running on code engine, then you can obtain the applications url from its **Domain mappings** on its **Details** page. 


In these exampes the application to be notified is listening on `http://my-machine:3000/notify`

eg.
```
curl -d "QMGR=QM1&QUEUE=DEV.QUEUE.1&NOTIFY=http://my-machine:3000/notify" -X POST -H "application/x-www-form-urlencoded"  http://observer-host:8080/register
```

or as json
```
curl -d "QMGR=QM1&QUEUE=DEV.QUEUE.1&NOTIFY=http://my-machine:3000/notify" -X POST -H "application/x-www-form-urlencoded"  http://observer-host:8080/register
```

You will recieve a response with a registration id

```
{"id":"bd41a85a-7cf4-456a-858b-7461aa21565d","qmgr":"QM1","queue":"DEV.QUEUE.1","notify":"http://my-machine:3000/notify"}
```

You can register a job name 

```
curl -d "QMGR=QM1&QUEUE=DEV.QUEUE.1&NOTIFY=mq-job" -X POST -H "application/x-www-form-urlencoded"  http://observer-host:8080/register
```

### Dropping registrations
To drop a registration run

```
curl -d "ID=bd41a85a-7cf4-456a-858b-7461aa21565d" -X DELETE -H "application/x-www-form-urlencoded"  http://observer-host:8080/register
```

To drop all registrations run

```
curl -X DELETE  http://observer-host:8080/admin/flush 
```

