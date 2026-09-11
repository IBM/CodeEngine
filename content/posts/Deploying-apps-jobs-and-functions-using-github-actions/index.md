---
title: "IBM Cloud Code Engine: Deploying Apps, Jobs and Functions using GitHub Actions"
date: 2024-02-23
description: "Deploying Apps, Jobs and Functions using GitHub Actions"
tags: ["serverless", "code engine", "github actions"]
draft: false
authors: ["lukeroy"]
---

## Introduction:
In the dynamic world of cloud computing, efficient deployment pipelines are a crucial part of a seamless development process. IBM [Code Engine](https://www.ibm.com/products/code-engine), a fully managed serverless offering, stands out by simplifying the deployment and running of Applications, Jobs, and Functions in the cloud at scale, eliminating the need for users to manage the underlying infrastructure.

To elevate the users development experience and workflow, we've introduced a dedicated GitHub Action designed to simplify the deployment process for GitHub users leveraging GitHub Actions as their CI/CD pipeline.

The GitHub Action `ibm/code-engine-github-action` empowers Code Engine users to seamlessly build and deploy applications, jobs, and functions directly from their GitHub repositories without the need to first manually build the program that they want to deploy or run multiple cli commands. This integration enhances the overall development lifecycle, providing a streamlined and automated approach to deploying and managing Code Engine resources.

## Getting Started
To get started, ensure that the GitHub Actions feature is enabled for your repository. While GitHub Actions are enabled by default for public repositories, users with private repositories may need to enable it from the Actions tab. All workflow configurations are stored within the `.github/workflows` directory, making it easily accessible for users to customize and manage their deployment pipelines.

To use the `ibm/code-engine-github-action` GitHub Action you will also need to create an API Key ([see the docs](https://cloud.ibm.com/docs/account?topic=account-userapikey&interface=ui)) and save it as a secret for your repository (Settings -> Secrets and variables > Actions). In this example the secret is called `IBM_IAM_API_KEY`.

After you have prepared your repository we can get started with two simple examples: the first on how to deploy a Code Engine App and the second one how to deploy a Code Engine Python Function.

## Deploying an App
Create a directory `my-ce-app` containing the source code you want to deploy to Code Engine. Inside the `my-ce-app` directory create the following files which make up a simple NodeJS Web Server.

[app.js](https://github.com/IBM/CodeEngine/blob/main/github-action-workflows/my-ce-app/app.js)
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

[package.json](https://github.com/IBM/CodeEngine/blob/main/github-action-workflows/my-ce-app/package.json)
```json
{
    "dependencies": {
      "express": "^4.17.1"
    }
}
```
Next, inside of the `.github/workflows` create the following GitHub Action workflow YAML called `deploy-ce-app.yml`. The workflow called `Deploy App to Code Engine` is executed when a push occurs against the `main` branch of the repository. Initially it checks out the repository. In the next step, the `ibm/code-engine-github-action` will be used to deploy the application (component: app) to Code Engine. It uses Code Engine's push feature so we don't need to create the container image ourselves. The deployment will be directed to the project `MY-PROJECT` within your default resource group in the `Frankfurt` region (`eu-de`). The application will be named `my-ce-node-app`, utilizing the content of the `my-ce-app` directory as the source code used for the build step. For more information about Code Engine Push see the [Code Engine Build Docs](https://cloud.ibm.com/docs/codeengine?topic=codeengine-build-config-local).

[deploy-ce-app.yml](https://github.com/IBM/CodeEngine/blob/main/github-action-workflows/my-ce-app/deploy-ce-app.yml)
```yaml
name: Deploy App to Code Engine
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
    - name: Deploy Application to Code Engine
      uses: ibm/code-engine-github-action@v1
      with:
        api-key: ${{ secrets.IBM_IAM_API_KEY }}
        region: 'eu-de'
        project: 'MY-PROJECT'
        component: 'app'
        name: 'my-ce-app'
        build-source: './my-ce-app'
```
Now, whenever changes are pushed into the `main` branch the Github Action is run and your Code is built and deployed to Code Engine always keeping your Application up to date with your latest changes.

## Deploying a Python Function
Create a directory `my-ce-py-func` containing your function source code you want to deploy to Code Engine. Inside the `my-ce-py-func` directory create the following files which make up a simple python function.

[__main__.py](https://github.com/IBM/CodeEngine/blob/main/github-action-workflows/my-ce-py-func/__main__.py)
```python
from lorem_text import lorem

def main(params):
     words = 10
     return {
          "headers": {
              "Content-Type": "text/plain;charset=utf-8",
          },
          "body": lorem.words(words),
      }
```

[requirements.txt](https://github.com/IBM/CodeEngine/blob/main/github-action-workflows/my-ce-py-func/requirements.txt)
```
lorem-text
```
Like the Application example inside of the `.github/workflows` create the following GitHub action Workflow YAML called `deploy-ce-py-func.yml` The workflow called `Deploy Python Function to Code Engine` is executed when a push occurs against the `main` branch of the repository. The `ibm/code-engine-github-action` will be used to deploy the Python Function (component: fn) to Code Engine. The deployment will be directed to the project `MY-PROJECT` within your default resource group in the `Frankfurt` region (eu-de). The Function will be named `my-ce-py-fn`, utilizing the content of the `my-ce-py-func` directory as the source code.

[deploy-ce-py-func.yml](https://github.com/IBM/CodeEngine/blob/main/github-action-workflows/my-ce-py-func/deploy-ce-py-func.yml)

```yaml
name: Deploy Python Function to Code Engine
on:
  push:
    branches:
      - main
jobs:
  fn-py:
    runs-on: ubuntu-latest
    steps:
    - name: Check out code
      uses: actions/checkout@v3
    - name: Deploy Python Function to Code Engine
      uses: ibm/code-engine-github-action@v1
      with:
        api-key: ${{ secrets.IBM_IAM_API_KEY }}
        region: 'eu-de'
        project: 'MY-PROJECT'
        component: 'fn'
        runtime: python-3.11
        name: 'my-ce-py-fn'
        build-source: './my-ce-py-func'
```

## Conclusion
In this blog, we learned how to create Applications and Functions and automatically deploy them to [IBM Cloud Code Engine] using GitHub Actions as a CI/CD solution. The Code Engine enables developers to effortlessly enhance their development workflows by leveraging a fully managed serverless solution. The workflows depicted above powered by `ibm/codeengine-github-action` simplify and enhance your deployment process and experience.

Now its up to you! To get started, head on over to [IBM Cloud Code Engine](https://www.ibm.com/products/code-engine)  and register for a new account or login to an existing IBM Cloud account and begin your serverless journey with Code Engine. Run your Applications, Jobs or Functions in the Cloud at scale. The documentation, additional information and examples can be found at the included links.

- [Code Engine](https://cloud.ibm.com/codeengine/overview)
- [Code Engine Docs](https://cloud.ibm.com/codeengine/overview)
- [Example Code](https://github.com/IBM/CodeEngine)
- [Code Engine Github Action](https://github.com/marketplace/actions/code-engine-github-action)
- [Example Source Code](https://github.com/IBM/CodeEngine/tree/main/github-action-workflows)
