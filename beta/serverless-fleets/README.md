# Simplify and optimize large-scale parallel computation with Serverless Fleets

As artificial intelligence continues to grow and demand for cloud-based solutions increases, the ability to run large-scale, compute-intensive workloads both quickly and efficiently has become critical.

In this hands-on lab, you will deploy your first Serverless Fleet on IBM Code Engine—IBM’s strategic container platform designed to handle large-scale, compute-intensive workloads.

Using both the intuitive graphical user interface and the command line, you will be guided step by step through the process. With just three clicks, you will have a Serverless Fleet up and running on IBM Cloud.

**Table of Contents:**

- [Key differentiators of Fleets](#key-differentiators-of-fleets)
- [What is a fleets](#what-is-a-fleet)
- [Architecture](#architecture)
- [One Time Setup](#one-time-setup)
- [Launch a Fleet](#launch-a-fleet)
- [Launch a Fleet with GPUs](#launch-a-fleet-with-gpus)
- [Launch a fleet with parallel tasks](#launch-a-fleet-with-parallel-tasks)
- [Launch a fleet to count words of novels](#launch-a-fleet-to-count-words-of-novels)
- [Tutorial: Docling](./tutorials/docling/README.md)
- [Tutorial: Batch Inferencing](./tutorials/inferencing/README.md)
- [Tutorial: Monte Carlo Simulation](./tutorials/simulation/README.md)
- [HowTo](#howto)
- [Troubleshooting](#troubleshooting)


## Key differentiators of Fleets

Fleets offer the following advantages:
1.	Support for large-scale parallel computing tasks, with no limits on vCPU, memory, or task duration.
2.	Automatic, dynamic scaling—from a single task to millions of tasks.
3.	Consumption-based pricing: pay only for the resources you use, with no idle or fixed costs.
4.	Fully managed service—no infrastructure administration required.
5.	Broad machine type support, including GPU-enabled instances.
6.	Seamless integration with your VPC network.

## What is a fleet

![](./images/prototype_concept.png)

A fleet (also referred to as a serverless fleet) is a Code Engine compute resource that runs one or more instances of user code in parallel to process a large set of compute-intensive tasks.

Fleets can connect to Virtual Private Clouds (VPCs) to securely access user data and services. They provide dynamic task queuing, single-tenant isolation, and support for GPU workloads.

A fleet consists of a collection of worker nodes that automatically scale up or down based on resource requirements. Each instance runs on a worker node to complete a single task. When a task finishes, the worker node immediately starts the next task in the queue. This process continues until all tasks are completed, after which the worker nodes are automatically deprovisioned.

Like applications, jobs, and functions, fleets run within a Code Engine project. A project is a grouping of Code Engine resources within a specific IBM Cloud region. Projects are used to organize resources and manage access to entities such as configmaps, secrets, and persistent data stores.


## Architecture 

The architecture used in this tutorial looks as follows.

![](./images/prototype_architecture.png)

Key aspects of the architecture:
1. Code Engine is running the fleet and provisions fleet workers
2. Fleet workers are VPC VSIs running in the Code Engine managed accounts
3. Fleet workers are provisioned based on an VSI image provided and managed by Code Engine
4. Fleet workers are connected to the VPC subnet owned by the customer
5. Tasks and data are stored in a Task State Store which is a COS bucket owned by the customer
6. Logs are ingested to an IBM Cloud Logs instances owned by the customer

In terms of roles and responsibilities it's important to understand that:
- The user is responsible to manage the VPC, Subnet, COS Bucket, Containers and ICL instance
- Code Engine is responsible to manage the life-cycle of Fleets, Tasks, Instances and Workers.

The One-time-setup procedure will help to automatically provision / de-provision all required resources, but NOT manage their life-cycle.

## One Time Setup

The tutorial has been tested on a MacOS and Ubuntu24 client machine with the following tools pre-installed:
- `ibmcloud` - IBM Cloud CLI
- `jq` - for parsing JSON response
- `rclone` - for syncing local directory with COS bucket

Clone this repository
```
git clone https://github.com/IBM/CodeEngine.git 
```

Switch to the `beta/serverless-fleets` directory, which will be the root directory for all steps of this tutorial

To run this end-to-end sample, open a terminal, [login into your IBM Cloud account using the IBM Cloud CLI](https://cloud.ibm.com/docs/codeengine?topic=codeengine-install-cli).

Install the Code Engine CLI with the latest version and enable fleets:
```
CE_EXPERIMENTAL_FLEET=true ibmcloud plugin install code-engine -f --quiet
```

If you don't have a fleet sandbox, choose one of the two methods to create one.

<a name="Fully automated creation of cloud resources (recommended)"></a>
<details>
  <summary>Fully automated creation of cloud resources</summary>

Run the following command, which will create all required cloud resources for you.
```
NAME_PREFIX=ce-fleet-sandbox REGION=eu-de ./init-fleet-sandbox
```


> Note: Your account need wide permissions to create all the resources mentioned above. If you don't have persmission, ask you Administrator or follow the steps for the [custom configuration](#custom-configuration)

The following resources will be created in the resource group `ce-fleet-sandbox--rg` in `eu-de`.

![](./images/prototype_resources.png)

The tutorial configures three COS buckets and corresponding Code Engine [Persistent Data Stores](https://cloud.ibm.com/docs/codeengine?topic=codeengine-persistent-data-store) for different purposes:
1. `fleet-task-store` - used by Code Engine to queue and persist tasks and their state
2. `fleet-input-store` - used to read data for processing like PDFs, or txt files
3. `fleet-outout-store` - used to write results as the output of processing

![](./images/prototype_persistant_data_stores.png)

In addition, the `init-fleet-sandbox` script configures a local rclone environment including the `.rclone-config` as well as the `upload` and `download` script. Use `./upload` to load data from your local `./data/input` directory to the `fleet-input-store` bucket and `./download` to download from the `fleet-output-store` bucket to the `./data/output` directory. This allows you to share files easily with your container instance.

You can later clean-up all resources by running `NAME_PREFIX=ce-fleet-sandbox REGION=eu-de ./init-fleet-sandbox clean`.
</details>

<a name="Bring your own cloud resources"></a>
<details>
  <summary>Bring your own cloud resources</summary>

If you already have a VPC, subnets, COS bucket and credentials you can just create the code engine project and related artefacts, follow the instructions in the official documentation

</details>
</br>

## Launch a Fleet

Run a serverless fleet that runs 1 single task and instance with 2 CPUs and 4 GB of memory that sleeps for 2 minutes
```
./run
```

<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ./run
ibmcloud code-engine beta fleet create
   --name fleet-b4bd2a33-1
   --tasks-state-store fleet-task-store
   --image registry.access.redhat.com/ubi8/ubi-minimal:latest
   --command=sleep
   --arg 60
   --tasks 1
   --cpu 2
   --memory 4G
   --max-scale 1
Successfully created fleet with name 'fleet-b4bd2a33-1' and ID 'e3caac88-cfc2-4602-8684-b527a6811716'
Run 'ibmcloud ce beta fleet get --id e3caac88-cfc2-4602-8684-b527a6811716' to check the fleet status.
Run 'ibmcloud ce beta fleet worker list --fleet-id e3caac88-cfc2-4602-8684-b527a6811716' to retrieve a list of provisioned workers.
OK
```
</details>
<br>

To observe the fleet and its progress, run a combination of the following commands. The fleet summarizes the number of workers, tasks and instances. A single worker will be provisioned. The worker will process a single task, which will move from *Pending* to *Running* to *Succeeded*. Afterwards the worker will be deprovisioned.

### Get the details of the fleet

```
ibmcloud ce beta fleet get --id <id>
```
<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce beta fleet get --id e3caac88-cfc2-4602-8684-b527a6811716
Getting fleet 'e3caac88-cfc2-4602-8684-b527a6811716'...
OK

Name:            fleet-b4bd2a33-1
ID:              e3caac88-cfc2-4602-8684-b527a6811716
Status:          pending
Created:         44s
Project region:  br-sao
Project name:    fleetlab-user1--ce-project

Tasks status:
  Failed:     0
  Cancelled:  0
  Succeeded:  0
  Running:    0
  Pending:    1
  Total:      1

Code:
  Container image reference:  registry.access.redhat.com/ubi8/ubi-minimal:latest
  Registry access secret:     fleet-registry-secret
  Command 0:                  sleep
  Argument 0:                 60

Tasks specification:
  Task state store:  fleet-task-store
  Indexes:           0-0

Resources and scaling:
  CPU per instance:          2
  Memory per instance:       4G
  Preferred worker profile:  cx2-2x4
  Max number of instances:   1
  Max execution time:
  Max retries per task:      3

Network placement:
  Network reference 0:  996b1f58-61d1-401c-9b53-312253de7f2c
```
</details>
<br>

### List the tasks of the fleet

```
ibmcloud ce beta fleet task list --fleet-id <id>
```
<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce beta fleet task list --fleet-id e3caac88-cfc2-4602-8684-b527a6811716
Listing serverless fleet tasks...
OK

Index        ID                                    Status   Result code  Worker ID
000-00000-0  b3c7c020-5e4c-50fb-ac7d-513b2fb95b5c  running  -            000-00000-0
```
</details>
<br>

### List the workers running in the fleet

```
ibmcloud ce beta fleet worker list --fleet-id <id>
```
<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce beta fleet worker list --fleet-id e3caac88-cfc2-4602-8684-b527a6811716
Listing serverless fleet workers...
OK

ID                                    Status        Profile  IP           Zone      Age
5b99e38f-f239-4340-a0c6-d70432c21730  initializing  cx2-2x4  10.250.0.15  br-sao-1  71s
```
</details>
<br>

🚀 You just launched a fleet with a single task 🚀


## Launch a Fleet with GPUs

Run a fleet that runs a single task on a *Serverless GPU* using a Nvidia L40s for 2 minutes:
```
./run_gpu
```

The GPUs are defined by setting the family and the number of GPUs per task, e.g. `--gpu GPU_FAMILY:NUMBER_OF_GPUS`, where the number of GPUs can be fractional for GPU families that support MIG. In our case we configure `--gpu l40s:1` with a `--max-scale 1` to get exactly one `gx3-24x120x1l40s`.

Observe the progress of the fleet with the same commands as above.

🚀 You just launched a fleet with a Serverless GPU 🚀

## Launch a fleet with parallel tasks

Run a serverless fleet to process 100 tasks where each tasks gets 1 CPU and 2 GB memory. Run 10 tasks in parallel and use a worker profile of cx2-2x4:

```
./run_parallel_tasks
```

<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud code-engine beta fleet create
  --name fleet-847292b7-1
  --image registry.access.redhat.com/ubi8/ubi-minimal:latest
  --tasks-state-store fleet-task-store
  --command=sleep
  --arg 2
  --tasks 100
  --cpu 1
  --memory 2G
  --max-scale 10
```
</details>
<br>

In the fleet details you will see 5 workers being provisined. The number of workers is determined by the profile, cpu/memory and number of parallel tasks. 

```
ibmcloud ce beta fleet get --id <id>
```

<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce beta fleet get --id 08a05e59-0a35-4da0-885f-5eb3f6f589d4
Getting fleet '08a05e59-0a35-4da0-885f-5eb3f6f589d4'...
OK

Name:            fleet-847292b7-1
ID:              08a05e59-0a35-4da0-885f-5eb3f6f589d4
Status:          pending
Created:         23s
Project region:  br-sao
Project name:    fleetlab-user1--ce-project

Tasks status:
  Failed:     0
  Cancelled:  0
  Succeeded:  0
  Running:    0
  Pending:    100
  Total:      100

Code:
  Container image reference:  registry.access.redhat.com/ubi8/ubi-minimal:latest
  Registry access secret:     fleet-registry-secret
  Command 0:                  sleep
  Argument 0:                 2

Tasks specification:
  Task state store:  fleet-task-store
  Indexes:           0-99

Resources and scaling:
  CPU per instance:         1
  Memory per instance:      2G
  Max number of instances:  10
  Max execution time:
  Max retries per task:     3

Network placement:
  Network reference 0:  daf4f3a0-00a6-46c3-b5cf-cbcbdba049fc
```
</details>
<br>


In our case, a cx2-2x4 has two CPUs and can run 2 instances on a single worker. Since we want to process 10 tasks in parallel, Code Engine provisioned 5 workers.

Repeat the following command until you see the Fleet worker to appear, which takes about 30s:

```
ibmcloud ce beta fleet worker list --fleet-id <id>
```

<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce beta fleet worker list --fleet-id 08a05e59-0a35-4da0-885f-5eb3f6f589d4
Listing serverless fleet workers...
OK

ID                                    Status        Profile   IP           Zone      Age
273d3d7c-cdb2-4ed9-ac97-bafe76f4f59f  initializing  cx2-8x16  10.250.0.16  br-sao-1  55s
99e535e2-acd0-4b9e-97a2-4e245402c13c  initializing  cx2-2x4   10.250.0.17  br-sao-1  55s

```
</details>
<br>

Observe the progress of the task execution by repeatingly running the following command:

```
ibmcloud ce beta fleet task list --fleet-id <id>
```

Altneratively, you can filter by status `--status <pending | running | successful | failed>`

<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce beta fleet task list --fleet-id 08a05e59-0a35-4da0-885f-5eb3f6f589d4
Listing serverless fleet tasks...
OK

Index         ID                                    Status   Result code  Worker ID
000-00000-65  00eef277-6973-56a7-9c7a-1cf1b4d1f945  pending  -            -
000-00000-80  020fa8bd-d30f-583d-acfa-84253bb2f399  pending  -            -
000-00000-72  06e4ef8f-1b8f-58b0-95cc-e8191d71403c  pending  -            -
000-00000-82  08aca6c5-c787-589f-8c9a-4f35483ec1ac  pending  -            -
000-00000-77  126be911-8238-5bf6-a5c6-a18991c60377  pending  -            -
...
```
</details>
<br>

Repeat the steps to observe the fleet.

:rocket: You just launched your first Serverless Fleet which run 100 tasks in parallel and scaled down after all tasks completed :rocket:

## Launch a fleet to count words of novels

This example will run a simple `wc` (word count) on a list of [novels](./data/input/wordcount) stored as objects in .txt format in Cloud Object Storage.
The 6 tasks are submitted using the `tasks-from-local-file` option using the [wordcount_commands.jsonl](./wordcount_commands.jsonl) as input.

![](./images/example_wordcount.png)

The example mounts the [Persistant Data Stores](https://cloud.ibm.com/docs/codeengine?topic=codeengine-persistent-data-store) (PDS) to the container using the `--mount-data-store MOUNT_DIRECTORY=STORAGE_NAME:[SUBPATH]`, where 
- `MOUNT_DIRECTORY` - is the directory within the container
- `STORAGE_NAME` - is the name of the PDS
- `SUBPATH` - is the prefix within the COS bucket to mount.

It mounts the `fleet-input-store:/wordcount` to `/input` and `fleet-output-store:/wordcount` to `/output`.

> Note, this example assumes that the automated One-Time-Setup has been performed. Otherwise, the upload and download would need to be done manually.


Four steps are required to run the example:

#### Step 1 - Upload files

Upload the .txt files from the local data directory to Cloud Object Storage
```
./upload
```

#### Step 2 - Run the fleet

Launch the fleet to perform `wc` on each of the novels which defines the tasks from [wordcount_commands.jsonl](./wordcount_commands.jsonl) and mounts the input and output data stores. 
```
./run_wordcount
``` 

Confirm that you uploaded the files with `#? 1`

<a name="output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ./run_wordcount
Did you upload the .txt files to COS?
1) Yes
2) No
#? 1
ibmcloud code-engine beta fleet run
  --name fleet-7e818989-1
  --image registry.access.redhat.com/ubi9/ubi-minimal:latest
  --tasks-from-local-file wordcount_commands.jsonl
  --cpu 1
  --memory 2G
  --max-scale 4
  --mount-data-store /input=fleet-input-store:/wordcount
  --mount-data-store /output=fleet-output-store:/wordcount
Successfully created fleet with name 'fleet-7e818989-1' and ID '3f7a1c2a-6d85-4b27-bc4f-7e519645e23b'
Run 'ibmcloud ce beta fleet get --id 3f7a1c2a-6d85-4b27-bc4f-7e519645e23b' to check the fleet status.
Run 'ibmcloud ce beta fleet worker list --fleet-id 3f7a1c2a-6d85-4b27-bc4f-7e519645e23b' to retrieve a list of provisioned workers.
Run 'ibmcloud ce beta fleet task list --fleet-id 3f7a1c2a-6d85-4b27-bc4f-7e519645e23b' to retrieve a list of tasks.
OK
```

</details>
<br>

#### Step 3 - Watch results

You can run the following command to watch the COS bucket for the results, press ctrl-c if all 6 results are present
```
./watch_result wordcount
```

<a name="output"></a>
<details>
  <summary>Output</summary>

```
Every 2.0s: ibmcloud cos list-objects-v2 --bucket fleetlab-dev-output-91b55a45 --prefix wordcount Jeremiass-MacBook-Pro.local: 13:48:47

OK
Name                                           Last Modified (UTC)        Object Size
wordcount/.keep                                Aug 29, 2025 at 12:05:04   0 B
wordcount/wordcount_alice_in_wonderland.txt    Sep 01, 2025 at 11:51:16   52 B
wordcount/wordcount_der_struwwelpeter.txt      Sep 01, 2025 at 11:51:14   47 B
wordcount/wordcount_dracula.txt                Sep 01, 2025 at 11:51:16   40 B
wordcount/wordcount_gullivers_travels.txt      Sep 01, 2025 at 11:51:14   50 B
wordcount/wordcount_romeo_and_juliet.txt       Sep 01, 2025 at 11:51:30   49 B
wordcount/wordcount_the_call_of_the_wild.txt   Sep 01, 2025 at 11:51:31   53 B

Found 7 objects in bucket 'fleetlab-dev-output-91b55a45'
```

</details>
<br>

#### Step 4 - Download the results

Download the results from the output COS bucket to `./data/output`

```
./download
```` 


🚀 The example was successful, if you can tell the number of words of the "Alice in Wonderland" novel 🚀


## Tutorials

- [Tutorial: Docling](./tutorials/docling/README.md)
- [Tutorial: Inferencing](./tutorials/inferencing/README.md)
- [Tutorial: Simulation](./tutorials/simulation/README.md)


## HowTo

### How to use your own container and image

In order to use your own container image, you would need to build and push the image to an ICR namespace within the cloud account.

Build:
```
podman build --platform linux/amd64,linux/amd64 . -t <region>.icr.io/<namespace>/<image>:<tag>
```

Push:
```
ic cr login --client podman
podman push <region>.icr.io/<namespace>/<image>:<tag>
```

Update the Code Engine registry secret to use the same registry endpoint:
```
ibmcloud ce secret update --name fleet-registry-secret --server <region>.icr.io
```

Once the push is complete, you can run the fleet by modifying `./run` and replace
- the image, e.g. `--image <region>.icr.io/<namespace>/<image>:<tag>`
- the command, e.g. `--command "/bin/bash"`
- the arguments, e.g. `--arg "-c" --arg "sleep 120"`
- the environment variables, e.g. `--env foo=bar`



### How to access logs

An IBM Cloud Logs instance is being setup and enabled by default during the automated One Time Setup. Each fleet worker will ingest logs to the IBM Cloud Logs instance by default. [Navigating to the UI](https://cloud.ibm.com/docs/cloud-logs?topic=cloud-logs-instance-launch) and use [Using Livetail](https://cloud.ibm.com/docs/cloud-logs?topic=cloud-logs-livetail) or [Filtering log data](https://cloud.ibm.com/docs/cloud-logs?topic=cloud-logs-query-data-filter) to view the logs.

![](./images/prototype_logs.png)

### Cleanup the Environment

To clean up all IBM Cloud resources, that have been created as part of the provided script, run:

```
./init-fleet-sandbox clean
```

## Troubleshooting

### How to delete workers manually?

If you need to end your fleet's processing before it ran to completion, or to get rid of workers that are kept alive for troubleshooting (see above), you can delete the workers.

Run the following command to delete a single worker:

```
ibmcloud ce exp fleet worker delete -n <worker-name>
```

Run the following command to delete all workers in your project:
```
ibmcloud ce exp fleet worker list | grep "fleet-" | awk '{print $1}' | xargs -L1 -I {} ibmcloud ce exp fleet worker delete --name {} -f
```
