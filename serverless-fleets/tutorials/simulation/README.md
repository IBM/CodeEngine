# Tutorial: Monte Carlo Simulation

This tutorial provides a comprehensive guide of running a simple stock price simulation from local source code using serverless fleets. The example, performs a Monte Carlo Simulation to calculate the Value-at-Risk of 24 stocks. As an input the user provides the source code and the list of 24 commands for each stock ticker. Code Engine *builds* are used to build the container image. The *serverless fleet* will autonomously spawns workers to run the simulation. The result is written to a Cloud Object Storage bucket.

Key steps covered in the Tutorial:
1. Containerization with Code Engine: Build the simulation container and push it to a registry for deployment.
3. Run a fleet of workers that automatically runs the container, ensuring scalability and efficiency.
4. Download the results from COS


![](../../images/examples_simulation_flow.png)

> Note: The tutorial assumes that you have created the fleet sandbox using the fully automated approach which creates the rclone environment as well as the upload/download scripts. If that's not the case, you would need to upload the PDFs and download the results using the COS CLI or other means.

## Steps


### Step 1 - Build and Push the container registry

Build the container image using Code Engine's build capabilities by running the following command in the `tutorials/simulation` directory.

If you're interested review the code, by looking at the [simulate.py](./simulate.py), which contains a simple method that downloads the last year stock prices of a stock ticker, performs 100k simulations and writes the VaR at a csv file. It receives the stock ticker and output directory as input arguments. 
```
cat simulate.py
```

Now, run the build script to run a Code Engine build to build a container image using and push it to the container registry

```
cd tutorials/simulation
./build
```

### Step 2 - Prepare the tasks

In this tutorial we use the `--tasks-from-file commands.jsonl` option to submit the tasks. Therefore we have prepared a file in [jsonfiles](https://jsonlines.org/) format which contains 1 task per line. Each line specifies command and arguments for this task. Let's review the file in the `tutorials/simulation` directory:

```
cat commands.jsonl
```

<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  simulation cat commands.jsonl
 { "cmds": ["python3"], "args": ["simulate.py", "AKAM", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "AA", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "MO", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "AMZN", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "AMGN", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "AAPL", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "T", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "BA", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "CAT", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "CVX", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "DIS", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "KO", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "DELL", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "F", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "INTC", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "IBM", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "MSFT", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "NFLX", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "NVDA", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "ORCL", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "QCOM", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "X", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "VZ", "/output"]}
 { "cmds": ["python3"], "args": ["simulate.py", "V", "/output"]}
```

</details>
<br/>


### Step 3 - Run the Fleet

Now run the fleet to process the 24 stock tickers. In this tutorial we use the `--tasks-from-file commands.jsonl` to specify the tasks. Each task will get 1 CPU and 4 GB memory. We specify a specific machine profile `--worker-profile mx2-4x32` and configure `--max-scale 24` to run all 24 simulations in parallel. Therefore, the system is deploying 6 workers, each running 4 instances concurrently, e.g. each worker is running 4 simulations at a point in time.
```
./run
```

<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  simulation ./run
ibmcloud code-engine fleet create --name fleet-c042e88d-1
  --tasks-state-store fleet-task-store \
  --subnetpool-name fleet-subnetpool \
  --image private.br.icr.io/ce--fleet-simulation/simulation
  --registry-secret ce-auto-icr-private-br-sao
  --worker-profile mx2-4x32
  --tasks-from-local-file commands.jsonl
  --cpu 1
  --memory 8G
  --max-scale 24
  --mount-data-store /output=fleet-output-store:/simulation
Successfully created fleet with name 'fleet-c042e88d-1' and ID '630569df-c6c0-44dc-a376-e2f5d8d7aad8'
Run 'ibmcloud ce fleet get --id 630569df-c6c0-44dc-a376-e2f5d8d7aad8' to check the fleet status.
Run 'ibmcloud ce fleet worker list --fleet-id 630569df-c6c0-44dc-a376-e2f5d8d7aad8' to retrieve a list of provisioned workers.
Run 'ibmcloud ce fleet task list --fleet-id 630569df-c6c0-44dc-a376-e2f5d8d7aad8' to retrieve a list of tasks.
OK
```
</details>
<br/>

Review the fleet
```
ibmcloud code-engine fleet get --id <fleet-id>
```
<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  simulation ibmcloud ce fleet get --id 630569df-c6c0-44dc-a376-e2f5d8d7aad8
Getting fleet '630569df-c6c0-44dc-a376-e2f5d8d7aad8'...
OK

Name:            fleet-c042e88d-1
ID:              630569df-c6c0-44dc-a376-e2f5d8d7aad8
Status:          pending
Created:         5s
Project region:  br-sao
Project name:    fleetlab-dev--ce-project

Tasks status:
  Failed:      0
  Canceled:    0
  Successful:  0
  Running:     0
  Pending:     24
  Total:       24

Code:
  Container image reference:  private.br.icr.io/ce--fleet-simulation/simulation
  Registry access secret:     ce-auto-icr-private-br-sao

Tasks specification:
  Task state store:           fleet-task-store
  Data store JSON reference:  fleet-task-store
  Data store object path:     /ce/2c76a9f0-507e-472b-84be-81efe50403f8/fleet-input/80d4f857-62f9-4292-9672-364109ae4aa6.jsonl

Resources and scaling:
  CPU per instance:          1
  Memory per instance:       8G
  Preferred worker profile:  mx2-4x32
  Max number of instances:   24
  Max retries per task:      3

Network placement:
  Subnet CRN 0:  crn:v1:bluemix:public:is:br-sao-1:a/327016f62a9544c18e7efdd4213297dd::subnet:02t7-61ad2d36-695c-41b2-8bd1-38ee926cb94a
```
</details>
<br/>



Verify that the machines are starting
```
ibmcloud code-engine fleet worker list --fleet-id <fleet-id>
```
<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  ibmcloud ce fleet worker list --fleet-id 709f5fee-59ca-41b3-b518-9e5f665e4d78
Listing serverless fleet workers...
OK

Name                                          ID                                    Status        Profile   IP           Zone      Version
fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-0  885a775f-9918-4da5-b9ee-40bb3dc3f02e  initializing  mx2-4x32  10.250.0.24  br-sao-1  v0.0.78
fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-1  554c2232-f7fe-4081-babc-c7490e90742a  initializing  mx2-4x32  10.250.0.23  br-sao-1  v0.0.78
fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-2  9b7f8195-10c1-43d5-854d-09043608f4d9  initializing  mx2-4x32  10.250.0.25  br-sao-1  v0.0.78
fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-3  033c0bbf-f601-4df5-a53e-76b9fe7ef255  initializing  mx2-4x32  10.250.0.22  br-sao-1  v0.0.78
fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-4  c21b4a8b-7468-415c-905e-7cafa8646222  initializing  mx2-4x32  10.250.0.21  br-sao-1  v0.0.78
fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-5  1113a857-9880-4193-9e6e-d62fc9c66a0f  initializing  mx2-4x32  10.250.0.26  br-sao-1  v0.0.78
```
</details>
<br/>

Observe the tasks:

```
ibmcloud code-engine fleet task list --fleet-id <fleet-id>
```
<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ibmcloud ce fleet task list --fleet-id 709f5fee-59ca-41b3-b518-9e5f665e4d78
Listing serverless fleet tasks...
OK

Index                           ID                                    Status   Result code  Worker name
000-00000-00000000000000000000  767658c4-a311-5cdb-86ee-1f81d5a0546d  running               fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-4
000-00000-00000000000000000001  8b6cf1f7-839e-56e0-b5ba-5cf76b950774  running               fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-3
000-00000-00000000000000000002  53d21f36-a46a-5caa-a3ec-ad37c33bf9ac  running               fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-3
000-00000-00000000000000000003  5b4426d6-bb15-5c39-b38a-bd42bbc402ca  running               fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-4
000-00000-00000000000000000004  9bc3ab9b-36a9-5bf1-aba4-6f594ca520ed  running               fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-0
000-00000-00000000000000000005  b21f26d8-bda3-5950-b109-f9eac16381ec  running               fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-5
000-00000-00000000000000000006  78d47365-3ced-59bb-b895-955c52fb4c28  running               fleet-709f5fee-59ca-41b3-b518-9e5f665e4d78-1
...
```
</details>
<br/>

### Step 4 - Download results

Download the results from the COS by running the following command in the root directory:
```
./download
```

You can find the results under
```
ls -l data/output/simulation/ticker_*
```

<a name="Output"></a>
<details>
  <summary>Output</summary>

```
➜  serverless-fleets ls -l data/output/simulation/ticker_*
-rw-r--r--  1 jeremiaswerner  staff  31 Sep 10 15:16 ticker_AA.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_AAPL.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_AKAM.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_AMGN.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_AMZN.result
-rw-r--r--  1 jeremiaswerner  staff  31 Sep 10 15:16 ticker_BA.result
-rw-r--r--  1 jeremiaswerner  staff  32 Sep 10 15:16 ticker_CAT.result
-rw-r--r--  1 jeremiaswerner  staff  32 Sep 10 15:16 ticker_CVX.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_DELL.result
-rw-r--r--  1 jeremiaswerner  staff  32 Sep 10 15:16 ticker_DIS.result
-rw-r--r--  1 jeremiaswerner  staff  30 Sep 10 15:16 ticker_F.result
-rw-r--r--  1 jeremiaswerner  staff  32 Sep 10 15:16 ticker_IBM.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_INTC.result
-rw-r--r--  1 jeremiaswerner  staff  31 Sep 10 15:16 ticker_KO.result
-rw-r--r--  1 jeremiaswerner  staff  31 Sep 10 15:16 ticker_MO.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_MSFT.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_NFLX.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_NVDA.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_ORCL.result
-rw-r--r--  1 jeremiaswerner  staff  33 Sep 10 15:16 ticker_QCOM.result
-rw-r--r--  1 jeremiaswerner  staff  30 Sep 10 15:16 ticker_T.result
-rw-r--r--  1 jeremiaswerner  staff  30 Sep 10 15:16 ticker_V.result
-rw-r--r--  1 jeremiaswerner  staff  31 Sep 10 15:16 ticker_VZ.result
-rw-r--r--  1 jeremiaswerner  staff  27 Sep 10 15:16 ticker_X.result
```
</details>
<br/>

