# Tutorial: Run PySCF with MPI on multi-core fleet workers

**PySCF** (Python-based Simulations of Chemistry Framework) is an open-source **quantum chemistry software package** written primarily in Python, designed for electronic structure calculations such as Hartree-Fock, post-Hartree-Fock, and density functional theory methods. It offers a flexible and modular programming environment for quantum chemistry simulations.

**MPI** (Message Passing Interface) is a standardized communication protocol used for **parallel programming** across distributed-memory systems. It enables **multiple processors** or nodes to exchange messages and coordinate tasks efficiently, making it a core technology in high-performance computing for **compute-intensive tasks**.

In the context of PySCF, MPI is used to **parallelize computationally demanding quantum chemistry calculations**. PySCF can launch MPI processes to distribute workload across multiple nodes or processors, improving performance and scalability. Additionally, PySCF supports hybrid parallelism by combining MPI with OpenMP threading to **optimize both speed and memory usage on multi-core architectures**. This hybrid approach allows each MPI process to spawn multiple threads, enhancing scalability and efficiency in large-scale calculations. 

Thus, PySCF leverages MPI to handle communication and workload distribution in compute-intensive quantum chemistry tasks, enabling efficient use of high-performance computing resources.

**Serverless fleets** can greatly enhance the automation and scalability of running thousands of PySCF and MPI jobs by managing the provisioning and orchestration of compute infrastructure in the cloud. Code Engine automatically allocates the necessary compute resources on demand, enabling large batches of quantum chemistry calculations to be executed in parallel without manual intervention. By abstracting away the complexities of resource management, serverless fleets ensure that compute-intensive PySCF workflows, which rely on MPI for distributed parallelism, can run efficiently and continuously at scale. This approach also supports long-running and complex simulations by persisting jobs in the cloud environment, allowing researchers to focus on their computational tasks while the underlying infrastructure dynamically scales to meet workload demands.


## Steps


### Step 1 - Build and Push the container registry

Build the container image using Code Engine's build capabilities by running the following command in the `tutorials/pyscf` directory.

If you're interested review the code, by looking at the `pyscf_mpi.py`, which contains a simple example of such chemical calculations using PySCF and MPI
```
cat pyscf_mpi.py
```

Now, run the build script to run a Code Engine to build a container image using and push it to the container registry

```
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
{ "command":"mpirun", "args": ["-np", "4", "python", "pyscf_mpi.py", "atom1", "/mnt/ce/data/result"]}
```
</details>
<br/>


### Step 3 - Run the Fleet

Now run the fleet to process the 24 stock tickers. In this tutorial we use the `--tasks-from-file <commands.jsonl>` to specify the tasks. Each task will get 1 CPU and 4 GB memory. We choose the mx2-4x32 profile and want to run a total of 24 simulations in parallel. Therefore, the system is deploying 6 workers, each running 4 instances concurrently, e.g. each worker is running 4 simulations at a point in time.
```
./run
```

<a name="Output"></a>
<details>
  <summary>Output</summary>

```
TBD
```
</details>
<br/>

Review the fleet
```
ibmcloud code-engine experimental fleet get -n <fleet-name>
```
<a name="Output"></a>
<details>
  <summary>Output</summary>

```
TBD
```
</details>
<br/>



Verify that the machines are starting
```
ibmcloud code-engine experimental fleet worker list
```
TBD
```
TBD
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
TBD
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
ls -l data/result/pyscf_*
```

<a name="Output"></a>
<details>
  <summary>Output</summary>

```
TBD
```
</details>
<br/>

