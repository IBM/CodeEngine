# Tutorial: Docling

This tutorial provides a comprehensive guide on using Docling to convert PDFs into Markdown format using serverless fleets. It leverages cloud object storage for managing both the input PDFs and the resulting Markdown files. The process is streamlined using IBM’s Code Engine to build the Docling container, which is then pushed to a container registry. Users can run a serverless fleet, which autonomously spawns workers to run the Docling container for efficient, scalable conversion tasks.

Key steps covered in the Tutorial:
1. Upload the examples PDFs to COS
2. Containerization with Code Engine: Build the Docling container and push it to a registry for deployment.
3. Run a fleet of workers that automatically runs the container, ensuring scalability and efficiency.
4. Download the resulting markdown files from COS

This setup is ideal for automating document conversion workflows in a cost-effective, serverless environment.


![](../../images/examples_docling_flow.png)

> Note: The tutorial assumes that you have created the fleet sandbox using the fully automated approach which creates the rclone environment as well as the upload/download scripts. If that's not the case, you would need to upload the PDFs and download the results using the COS CLI or other means.

## Steps


### Step 1 - Upload

The 11 example PDFs are located in the `data/tutorials/docling/pdfs` directory. Run the following commands in the root directory to list and upload the example PDFs to COS.
```
ls data/tutorials/docling/pdfs
./upload
```

### Step 2 - Build and Push the container registry

Build the container image using Code Engine's build capabilities by running the following command in the `tutorials/docling` directory.
```
cd tutorials/docling
./build
```

### Step 3 - Run the Fleet

Now run the fleet to process the PDFs. In this tutorial we use the static array index with `--task 11` to specify the tasks for the 11 pdfs. The command is a bash script which is using the `CE_TASK_ID`, which contains values `0..10`, to fetch the pdf file. It's then running docling with 24 CPUs on the mx3d-24x240 worker. Therefore it's only running one instance per worker and utilizing the full worker. We run 4 instance and workers in parallel. Run the fleet with the following command in the `tutorials/docling` directory.
```
./run
```

<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  docling ./run
using image: de.icr.io/ce--fleet-docling/docling
ibmcloud code-engine experimental fleet run --name fleet-0eb02f2f-1
  --image de.icr.io/ce--fleet-docling/docling
  --registry-secret fleet-registry-secret
  --worker-profile mx3d-24x240
  --max-scale 4
  --tasks 11
  --cpu 24
  --memory 240G
  --command=bash
  --arg -c
  --arg mkdir -p /mnt/ce/data/result/$CE_FLEET_ID/; cd /mnt/ce/data/tutorials/docling/pdfs; files=( * ); docling --artifacts-path=/root/.cache/docling/models ${files[CE_TASK_ID]} --num-threads 24 --output /mnt/ce/data/result/$CE_FLEET_ID/;
Preparing your tasks: ⠼ Please wait...took 11.233582 seconds.
Preparing your tasks: ⠴ Please wait...
COS Bucket used 'ce-fleet-sandbox-data-fbfdde1d'...
Launching fleet 'fleet-0eb02f2f-1'...
Current fleet status 'Launching'...
OK
Getting Fleet 'fleet-0eb02f2f-1'...
OK

Name:          fleet-0eb02f2f-1
Status:        provisioning
Age:           0s
Created:       2025-04-30T08:56:58+02:00
Project Name:  ce-fleet-sandbox--ce-project
ID:            a73a8ed0-fe7d-4335-971d-f9932516b4d3

Task Summary:
  Tasks:                 11
  Instances:             4
  Workers:               4
  Instances per Worker:  1
```
</details>
<br/>


Verify that the machines are starting
```
ibmcloud code-engine experimental fleet worker list
```
<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce exp fleet worker list
Listing serverless fleet workers...
OK

Name                           Status   IP            Zone     Age  Profile      Fleet Name
fleet-0eb02f2f-10000-80223816  running  10.243.0.116  eu-de-1  78s  mx3d-24x240  fleet-0eb02f2f-1
fleet-0eb02f2f-10001-07b9f1c9  running  10.243.0.117  eu-de-1  78s  mx3d-24x240  fleet-0eb02f2f-1
fleet-0eb02f2f-10002-33e72f0f  running  10.243.0.115  eu-de-1  78s  mx3d-24x240  fleet-0eb02f2f-1
fleet-0eb02f2f-10003-1a2cc4c0  running  10.243.0.118  eu-de-1  78s  mx3d-24x240  fleet-0eb02f2f-1
```
</details>
<br/>

Observe the tasks:

```
ibmcloud code-engine experimental fleet task list --fleet-name <fleet-name>
```
<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce exp fleet task list --fleet-name fleet-0eb02f2f-1
Getting your tasks: ⠸ Please wait...Duration of list in seconds '0.262680'...
Project Name:  ce-fleet-sandbox--ce-project
Project ID:    e1501040-e56e-48b6-b9f0-1695908199bf
Fleet Name:    fleet-0eb02f2f-1
ID:            a73a8ed0-fe7d-4335-971d-f9932516b4d3



COS Task Store:
Bucket Name:  ce-fleet-sandbox-data-fbfdde1d
Prefix:       e1501040-e56e-48b6-b9f0-1695908199bf/a73a8ed0-fe7d-4335-971d-f9932516b4d3/v1/queue/

Task Summary:
Pending Tasks:    7
Running Tasks:    4
Failed Tasks:     0
Succeeded Tasks:  0
```
</details>
<br/>

If you like you can jump to the machine and see docling processing by running the following command in the root directory:
```
./jump <IP>
```

You can use `htop` to see that docling is processing the PDFs
![](../../images/examples_docling.jpg)

### Step 4 - Download results

Download the results from the COS by running the following command in the root directory:
```
./download
```

You can find the results under
```
ls -l data/result/<fleet-id>/
```


