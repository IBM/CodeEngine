---
title: "Creating a IBM Cloud Code Engine Function Code Bundle FROM scratch"
date: 2025-08-04
description: "Creating a IBM Cloud Code Engine Function Code Bundle FROM scratch"
tags: ["serverless", "code engine", "functions"]
featureImage: "featured.jpg"
draft: false
authors: ["lukeroy"]
---

Have you ever wanted to create a Code Engine Function code bundle that runs as a Python or Node.js function on [IBM Cloud Code Engine](https://www.ibm.com/products/code-engine), without relying on the Code Engine CLI to build it?

This guide walks you through a manual method to create a Code Bundle, giving you more control over the build process. While this approach is not encouraged as it can lead to unexplained behaviours it’s ideal for experienced developers who need flexibility in how their functions are packaged and deployed.

**Important**: Ensure you run all commands in an **amd64/Linux environment** using the correct runtime version for your function. Refer to the [Code Engine Function Runtimes documentation](https://cloud.ibm.com/docs/codeengine?topic=codeengine-fun-runtime) for supported versions. You should also have a IBM Cloud account and be familiar with IBM Cloud Code Engine and [IBM Cloud Container Registry](https://www.ibm.com/products/container-registry).

## Step-by-Step Guide
## 1. Prepare your source code

You can create either a Python or Node.js function for IBM Cloud Code Engine. Example source code for both runtimes is available in the following GitHub repositories:

- [Python code bundle](https://github.com/IBM/CodeEngine/tree/main/helloworld-samples/function-codebundle-python)
- [Node.JS code bundle](https://github.com/IBM/CodeEngine/tree/main/helloworld-samples/function-codebundle-nodejs)

Typically, you would use the Code Engine CLI to build and deploy your function in a single step. For example:

### For Python:
```bash
$ ibmcloud ce fn create -n lorem-python -runtime python-3.11 --build-source .
```


### For Node.JS:
```bash
$ ibmcloud ce fn create -n lorem-node -runtime nodejs-20 --build-source .
```

After running one of these commands, your function is automatically built, deployed, and ready to invoke via the generated URL — no additional steps required.  
However, in this guide, we’ll manually perform the build and packaging steps. This approach gives you deeper insight and greater control over how your function is constructed and deployed.

## 2. Installing Dependencies for Your Function

Once you’ve created your source code files `__main__.py` and `requirements.txt` for Python, or `main.js` and `package.json` for Node.js you can proceed to install any additional dependencies required by your function. Ensure you are in the directory where your source code is.

### For Python:
Set up a virtual environment and install the dependencies listed in your `requirements.txt` file. This will create a `virtualenv` directory containing all the necessary packages:  
```bash
$ virtualenv virtualenv
$ source virtualenv/bin/activate
$ pip install -r requirements.txt
```
### For Node.js:
Use npm to install the dependencies defined in your `package.json`. This will generate a `node_modules` directory:  
```bash
$ npm install
```
These steps ensure that all runtime dependencies are downloaded and ready for packaging into your Code Engine function.
## 3. Packaging and Publishing Your Function Code and Dependencies

With your source code and dependencies ready, the next step is to bundle everything into a .tar.gz archive. This archive will later be added to a container image for deployment.

### For Python:
Include your code `__main__.py`, dependencies `requirements.txt`, and the virtual environment directory `virtualenv`:
```bash
$ tar -czf myfuncbundle.tar.gz __main__.py requirements.txt virtualenv
```
### For Node.js:
Include your `main.js`, `package.json`, and the `node_modules` directory:
```bash
$ tar -czf myfuncbundle.tar.gz main.js package.json node_modules
```
Now that your code and dependencies are bundled in a tar.gz , the final step is to create a container image that can be stored in a container registry — specifically, the IBM Cloud Container Registry in this case.
This image will contain a single layer with your function. Note that this is not an executable container, it simply holds the function code for Code Engine to extract and run.

Create a file named `Dockerfile` with the following content.

**Dockerfile:**
```dockerfile
FROM scratch
ADD myfuncbundle.tar.gz .
```
Build the image and push it to IBM Cloud Container Registry using the following commands. Replace mynamespace with your actual IBM Cloud Container Registry namespace:

```bash
$ docker build -t us.icr.io/mynamespace/myfuncbundle .
$ docker push us.icr.io/mynamespace/myfuncbundle
```
Once pushed, this image can be referenced when creating/updating your function in Code Engine.

## 4. Deploying Your Function with a Custom Code Bundle

With your function code bundle pushed to the IBM Cloud Container Registry, you’re ready to create/update your function using the Code Engine CLI. Instead of building from source, you’ll reference your pre-packaged code bundle stored in the registry.

### For Python:
```bash
$ ibmcloud ce function create --name myfunc --runtime python-3.11 --code-bundle us.icr.io/mynamespace/myfuncbundle
````

### For Node.JS:
```bash
$ ibmcloud ce function create --name myfunc --runtime nodejs-20 --code-bundle us.icr.io/mynamespace/myfuncbundle
```
Be sure to replace mynamespace with your actual IBM Cloud Container Registry namespace.

This command creates your function on IBM Cloud Code Engine, using your custom bundle as the source. Once created, the function is ready to be invoked via its generated URL.
## Summary

By manually creating a Code Engine function bundle, you’ve unlocked a deeper understanding of how IBM Cloud Code Engine handles function packaging and deployment. This method gives you full control over your function dependencies and build, process — ideal for advanced use cases or custom CI/CD pipelines. However, for most scenarios, it is strongly recommended to use the Code Engine CLI, which simplifies the process and ensures compatibility with the platform’s evolving features. While the manual approach is powerful, the CLI remains the most reliable and supported way to build and deploy your functions. Happy coding — and may your functions run fast and fault-free!