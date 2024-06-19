# Contributing to ibmmq-observer 

Thank you for your interest in contributing to our open-source project, Code Engine ibmmq-observer. 

To ensure that the codebase is always healthy and does not result in deployment issues when forked and used, it is important that you pre-check your additions and updates for any potential code conflicts before uploading your changes to the GitHub Repository. 

Therefore, the following steps should be followed to submit your contributions: 

1. Fork the repository
2. Run test, format
3. Run deploy script
4. Commit/Push changes to your fork
5. Create a Pull Request 


### 1. Fork the repository

To fork the repository:
- Get started by clicking on "Fork" from the top-right corner of the main repository page.
- Choose a name and description for your fork.
- Select the option "Copy the main branch only", as in most cases, you will only need the default branch to be copied.
- Click on "Create fork".

Once you have forked the repository, you can then clone your fork to your computer locally. In order to do that:
- Click on "Code" (the green button on your forked repository).
- Copy the forked repository URL under HTTPS.
- Type the following on your terminal:

```
git clone <the_forked_repository_url> 
cd CodeEngine/ibmmq-observer
```

You can set up Git to pull updates from the MQ-Ansible repository into the local clone of your fork when you fork a project in order to propose changes to the MQ-Ansible repository. In order to do that, run the following command:

```
git remote add upstream https://github.com/IBM/CodeEngine/
```

To verify the new upstream repository you have specified for your fork, run the following command:

```
git remote -v
```

You should see the URL for your fork as origin, and the URL for the MQ-Ansible repository as upstream.

Now, you can work locally and commit to your changes to your fork. This will not impact the main branch.

### 2. Run tests and format script

Before committing changes, ensure that they work with the main codebase. 

In the repository, navigate to `observer`. You will find a makefile that will `fmt`, `vet`, `build` and `test`. Run 
```
make
```
and ensure that all marked failures identified are fixed.

Repeat for `sample-consumer`


If the make steps run successfully and no errors are displayed, then test the observer and sample-consumers locally. They can be run either natively or as podman / docker containers. 

If building on Apple Silicon machines you can use `buildx` or `--platform` to build the container images. eg.

```
podman build --platform linux/amd64 -t mq-observer .
```

```
podman build --platform linux/amd64 -t mq-consumer -f Dockerfile.consumer .
```

Then run normally. eg.

```
podman run --rm  --env TEST=1 --rm localhost/mq-observer:latest
```

```
podman run --rm  --env CE_QMGR=QM1 --env CE_QUEUE=DEV.QUEUE.2 localhost/mq-consumer:latest
```

### 3. Run deploy script
Run the `.deploy.sh` to ensure that the observer application and sample consumer job and the associated secrets and configmaps are created and start. 


### 4. Commit/Push changes to your fork 

If you are looking to add all the files you have modified in a particular directory, you can stage them all with the following command:

```
git add . 
```

If you are looking to recursively add all changes including those in subdirectories, you can type: 

```
git add -A 
```

Alternatively, you can type _git add -all_ for all new files to be staged. 

Once you are ready to submit your changes, ensure that you commit them to your fork with a message. The commit message is an important aspect of your code contribution; it helps the maintainers of MQ-Ansible and other contributors to fully understand the change you have made, why you made it, and how significant it is. 

You can commit your changes by running: 

```
git commit -s -m "Brief description of your changes/additions"
```

All commits must be signed.

To push all your changes to the forked repo:

```
git push
```

### 4. Create a Pull Request

Merge any changes that were made in the original repository’s main branch:

```
git merge upstream/main
```

Before creating a Pull Request, ensure you have read the [IBM Contributor License Agreement](CLA.md). By creating a PR, you certify that your contribution:
1. is licensed under Apache Licence Version 2.0, The MIT License, or any BSD License.
2. does not result in IBM MQ proprietary code being statically or dynamically linked to Ansible runtime.

Once you have carefully read and agreed to the terms mentioned in the [CLA](CLA.md), you are ready to make a pull request to the original repository.

Navigate to your forked repository and press the _New pull request_ button. Then, you should add a title and a comment to the appropriate fields and then press the _Create pull request_ button.

The maintainers of the original repository will then review your contribution and decide whether or not to accept your pull request.
 