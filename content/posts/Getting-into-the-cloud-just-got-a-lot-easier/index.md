---
title: "IBM Cloud Code Engine GitHub Action: Getting into the Cloud just got a lot easier!"
date: 2025-11-26
description: "Getting into the Cloud just got a lot easier!"
tags: ["serverless", "code engine", "github actions"]
featureImage: "featured.jpg"
draft: false
authors: ["luke-roy-ibm"]
---

## Introduction

[IBM Cloud Code Engine](https://www.ibm.com/products/code-engine) is IBM’s fully managed, strategic serverless platform that lets you run container images, batch jobs, source code, and functions in the cloud — without worrying about infrastructure management or scalability. It’s designed to simplify cloud-native development so you can focus on building, your business logic, not managing infrastructure. To make the developer experience even smoother, we introduced the [IBM Cloud Code Engine GitHub Action](https://github.com/IBM/code-engine-github-action). This action allows you to automate the build and deployment of your apps, jobs, and functions directly to Code Engine from your GitHub workflows.

And now, it just got even better!

We’re excited to announce new capabilities that take automation and flexibility to the next level:

### Build from Source with Ease:
The action now supports building a container image directly from your source code and storing it in [IBM Cloud Container Registry](https://www.ibm.com/products/container-registry) — ready for deployment.

### Multiple Build Strategies:

- Buildpacks (default): No Dockerfile required! Perfect for quick builds without extra configuration.
- Dockerfile: For developers who want full control over their build process.

### Image Support for Apps and Jobs:
Instead of building and deploying every time, you can now reference existing container images, including private ones. This opens the door to advanced workflows, such as multi-stage builds or integrating with external CI/CD pipelines.

With these enhancements, getting your workloads into the cloud has never been easier — or more powerful.

## Getting Started

Before diving into the examples, it’s important to prepare your repository for seamless integration with IBM Cloud Code Engine. Here’s what you need to do:

## Prerequisites

First, enable GitHub Actions for your repository. This can be done an a per repository basis. If your repository isn’t already enabled for GitHub Actions, check your access permissions, and reach out to the administrator of the GitHub organization.

## IBM Cloud account preparations

If you’re building a proof of concept or trying out the Code Engine for the first time, create an [IBM Cloud API Key](https://cloud.ibm.com/iam/apikeys) to authenticate your workflows with IBM Cloud services. For production-grade workloads create an IBM Cloud service ID API Key to authenticate your workflows with IBM Cloud services, as described below:

- Navigate to [Manage → Access (IAM) → Service IDs](https://cloud.ibm.com/iam/serviceids) .
- Click Create service ID, give it a name, assign Access policies to `Resource group only`, `Code Engine` and `Container Registry`. Then create a API key and copy the generated key for later use. See the [documentation](https://cloud.ibm.com/docs/iam?topic=iam-serviceidapikeys) for additional information.

Regardless whether you are using a personal API Key, or a service ID API Key, store it’s value as a GitHub secret:

- On GitHub.com, navigate to your repository and go to Settings → Secrets and variables → Actions.
- Create a new secret named `IBM_IAM_API_KEY` (or any name you prefer) and paste the API key you've generated.

Congratulations, your repository is now ready to leverage the IBM Cloud Code Engine GitHub Action. Let’s move on to the exciting part — exploring the new functionalities with hands-on examples! This blog post, uses pretty simple hello world examples. If you’re looking for more advanced code examples and sample workflows, be sure to check out the [Code Engine Sample Repository](https://github.com/IBM/CodeEngine), or revisit my initial blogpost [IBM Cloud Code Engine: Deploying Apps, Jobs and Functions using GitHub Actions](https://medium.com/@luke.roy/ibm-cloud-code-engine-deploying-apps-jobs-and-functions-using-github-actions-76de1f8352a3) that showcased the Code Engine GitHub Action.

## Building and Pushing a Container Image to IBM Container Registry (ICR) Using Code Engine:

Start by creating a directory my-ce-app containing the source code you want to build and push to ICR using Code Engine build run. Inside the my-ce-app directory create the following files which make up a simple Node.JS Web Server.

`app.js`

```javascript
const express = require("express");
const app = express();
const port = 8080;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(JSON.stringify({ body: "Hello from Node" }));
});
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
process.on("SIGTERM", () => {
  console.info("SIGTERM signal received.");
  server.close(() => {
    console.log("Http server closed.");
  });
});
```

`package.json`

```json
{
    "dependencies": {
      "express": "^4.17.1"
    }
}
```

`build-push.yml`

```yaml
name: Build and Push to ICR

on:
  push:
    branches:
      - main
jobs:
  app:
    runs-on: ubuntu-latest
    steps:
    - name: Check out code
      uses: actions/checkout@v3
    - name: Build and Push to ICR
      id: build-step
      uses: ibm/code-engine-github-action@v1
      with:
        api-key: ${{ secrets.IBM_IAM_API_KEY }}
        region: 'eu-de'
        project: 'MY-PROJECT'
        component: 'build'
        name: 'my-ce-app'
        image: private.de.icr.io/my-namespace/my-image:latest
        registry-secret: ce-auto-icr-private-eu-de
        build-source: './my-ce-app'
    - name: Get image with digest
      run: | 
        echo "Image with digest: ${{ steps.build-step.outputs.image-with-digest }}"
```

Next, inside of the `.github/workflows` create the following GitHub Action workflow YAML called `build-push.yml`. The workflow called "Build and Push to ICR" is executed when a push occurs against the main branch of the repository. Initially, it checks out the repository. In the next step, the `ibm/code-engine-github-action` will be used to build the container image (component: build) using Code Engine build run functionality and push the resulting container image to private ICR in `eu-de` using the auto generated registry secret created by Code Engine this can be omitted as this is the default value for the Code Engine GitHub Action. The build will be directed to the project `MY-PROJECT` within your default resource group in the Frankfurt region (`eu-de`). The build run will be named `my-ce-build` appended with the current timestamp the resulting image will be named `private.de.icr.io/my-namespace/my-image:latest`, utilizing the content of the `my-ce-app` directory as the source code used for the build step. The image refrerence and its digest is outputted for use in subsequent steps using `${{ steps.build-step.outputs.image-with-digest }}`. For more information about Code Engine Push see the [Code Engine Build Docs](https://cloud.ibm.com/docs/codeengine?topic=codeengine-build-standalone).

**Please note**: The example depicted above uses `my-namespace` as the IBM Container Registry namespace. As namespaces are unique, you'll need to use your own one.

## Building and Deploying Your Code Engine App Using the Dockerfile Build Strategy

If you need more control over the build process -- such as adding custom dependencies, performance optimzation, or fine-tuning configurations -- the Dockerfile build strategy is the way to go. Unlike buildpacks, which handle most of the heavy lifting automatically, Dockerfile gives you full flexibility for advanced use cases.
Start by organizing your application source (main.go) code and a Dockerfile inside the `my-docker-app` directory. This directory will contain everything needed to build your container image.

`main.go`

```golang
package main
import (
    "fmt"
    "net/http"
    "time"
)
func greet(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello World! %s", time.Now())
}
func main() {
    http.HandleFunc("/", greet)
    http.ListenAndServe(":3000", nil)
}
```

`Dockerfile`

```dockerfile
FROM quay.io/projectquay/golang:1.24 AS build-env
WORKDIR /go/src/app
COPY main.go main.go
RUN CGO_ENABLED=0 go build -o /go/bin/app main.go
FROM gcr.io/distroless/static-debian12
EXPOSE 3000
COPY --from=build-env /go/bin/app /
ENTRYPOINT ["/app"]
```

`build-dockerfile-app.yml`

```yaml
name: Deploy App to Code Engine using Dockerfile build-strategy
on:
  push:
    branches:
      - main
  workflow_dispatch:
jobs:
  deploy-app:
    runs-on: ubuntu-latest
    steps:
    - name: Check out code
      uses: actions/checkout@v3
    - name: Deploy App to Code Engine using Dockerfile build-strategy
      uses: IBM/code-engine-github-action@v1
      with:
        api-key: ${{ secrets.IBM_IAM_API_KEY }}
        resource-group: 'Default'
        region: 'eu-de'
        project: 'MY-PROJECT'
        component: 'app'
        build-strategy: 'dockerfile'
        port: 3000
        name: 'my-docker-app'
        build-source: './my-docker-app'
        cpu: 1
        memory: 4G
```

Next, navigate to the `.github/workflows directory` and create a new GitHub Actions workflow file named `build-dockerfile-app.yml`. This workflow is responsible for automating the build and deployment process for your application. Specifically, it will use IBM Cloud Code Engine to build the application from the source code located in the my-docker-app directory, leveraging the provided Dockerfile to create the container image. Once the image is successfully built, the workflow will deploy it as a Code Engine application, ensuring a streamlined and reproducible CI/CD pipeline.

## Deploying an Existing Container Image to Code Engine as an Application

If you already have a container image built elsewhere -- perhaps as part of another CI/CD pipeline or stored in a private registry -- you can now deploy it directly to IBM Cloud Code Engine without rebuilding. This feature is perfect for teams that want to reuse pre-built images or integrate Code Engine into existing workflows.
Inside of the `.github/workflows` create the following GitHub Action workflow YAML called `my-img-app.yml`. Instead of specifying source code or a build strategy, you reference the container image you want to deploy. This can be an image stored in IBM Container Registry (ICR) or any other registry, including private ones. We will be using the Code Engine Hello World image: `icr.io/codeengine/helloworld:latest`. In your workflow configuration, you’ll define key parameters like the project name, region, and resource group, along with the image reference and application settings (such as CPU and memory). Once triggered -- either on a push to the main branch or manually -- the workflow will deploy your application to Code Engine using the specified image.

`my-img-app.yml`

```yaml
name: Deploy Application to Code Engine using existing container image
on:
  push:
    branches:
      - main
  workflow_dispatch:
jobs:
  deploy-app:
    runs-on: ubuntu-latest
    steps:
    - name: Check out code
      uses: actions/checkout@v3
    - name: Deploy Application to Code Engine using existing container image
      uses: IBM/code-engine-github-action@v1
      with:
        api-key: ${{ secrets.IBM_IAM_API_KEY }}
        resource-group: 'Default'
        region: 'eu-de'
        project: 'MY-PROJECT'
        component: 'app'
        name: 'my-img-app'
        image: icr.io/codeengine/helloworld:latest
        cpu: 1
        memory: 4G
```

These examples highlight how the new GitHub Action features make it easier to automate builds, manage deployments, and create advanced workflows for your cloud-native applications.

## Conclusion

The IBM Cloud Code Engine GitHub Action makes deploying cloud-native workloads easier, faster, and more flexible than ever before. With support for multiple build strategies, image-based deployments, and seamless integration with GitHub Actions, you can automate your entire build-and-deploy pipeline without leaving your development workflow.

Whether you’re building from source using buildpacks, fine-tuning with a Dockerfile, or deploying pre-built images from your registry, these new capabilities empower you to create advanced CI/CD workflows tailored to your needs. No more manual steps — just streamlined automation that gets your applications, jobs, and functions running in the cloud with minimal effort.

Getting into the cloud has never been this easy — so why wait? Start automating your deployments now!

- [Code Engine](https://www.ibm.com/products/code-engine)
- [Code Engine Docs](https://cloud.ibm.com/docs/codeengine)
- [Example Code](https://github.com/IBM/CodeEngine)
- [Code Engine Github Action](https://github.com/marketplace/actions/code-engine-github-action)
- [Example Source Code](https://github.com/IBM/CodeEngine/tree/main/github-action-workflows)
- [IBM Cloud Code Engine: Deploying Apps, Jobs and Functions using GitHub Actions](https://medium.com/@luke.roy/ibm-cloud-code-engine-deploying-apps-jobs-and-functions-using-github-actions-76de1f8352a3)