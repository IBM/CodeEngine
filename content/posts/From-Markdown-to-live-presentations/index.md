---
title: "From Markdown to Live Presentations: Serverless Slidev Deployments with Code Engine Functions and GitHub Actions"
date: 2026-06-22
description: " Serverless Slidev Deployments with Code Engine Functions and GitHub Actions"
tags: ["serverless", "code engine", "functions", "slidev", "spa", "github actions"]
featureImage: "featured.jpg"
draft: false
authors: ["luke-roy-ibm"]
---

In our previous post, we explored how to deploy a Single Page Application (SPA) using [IBM Cloud Code Engine](https://www.ibm.com/products/code-engine) Functions removing the need for complex build pipelines and letting the platform handle everything automatically. Read the original post [here](https://ibm.github.io/CodeEngine/posts/serverless-spa-deployment-with-code-engine-functions/). Along the way, we also showed how to streamline deployments using our official Code Engine GitHub Action, enabling CI/CD and fully automated deployments directly from your repository to Code Engine [Code Engine GitHub Action Blog](https://ibm.github.io/CodeEngine/posts/deploying-apps-jobs-and-functions-using-github-actions/).

Now, let's take that idea even further. Imagine a workflow where you simply write your presentation in Markdown, preview it locally, push it to GitHub, and have it automatically deployed as a live web presentation, no manual builds, no infrastructure to manage, and no deployment scripts. Just Markdown to a live URL in minutes.

This is made possible by IBM Cloud Code Engine, IBM's strategic serverless compute platform designed to run a wide range of workloads, including Applications, Jobs, Serverless Fleets and Functions, without requiring you to manage infrastructure. Functions, in particular, provide a lightweight and powerful model: small, stateless pieces of code that execute on demand, typically triggered via HTTP. With support for Node.js and Python, Code Engine Functions offer a simple yet flexible way to serve dynamic logic and, as we'll explore in this post, even static content like presentations.

In this follow-up, we'll combine these capabilities with modern developer tooling to create a seamless experience: author your content in Markdown, and let Code Engine take care of everything else—from build to deployment to hosting.


## What is Slidev?

[Slidev](https://sli.dev) is a developer-focused presentation framework that lets you write slides entirely in Markdown. Rather than dragging elements around a GUI, you write plain text with a simple syntax—code blocks, headings, lists—and Slidev renders them as polished, interactive slides in the browser. It supports syntax-highlighted code snippets, LaTeX math, custom themes, animations, and even embedded Vue components, making it particularly well-suited for technical talks and developer workshops.

Under the hood, Slidev compiles your Markdown into a static Single Page Application (SPA) that can be served from any web host. That SPA output is exactly what we'll package and deploy as a Code Engine Function, so every time you push a change to your `slides.md`, a fresh build is triggered and your live presentation URL is updated automatically.


## Prerequisites and Setup

We combine three simple but powerful building blocks to create a seamless, fully automated workflow: Slidev for writing presentations in Markdown, a Code Engine SPA function to serve the presentation as a serverless web application, and GitHub Actions to automate deployment directly from your repository. Together, these enable a setup where you focus purely on content while the platform handles everything else. Slidev allows you to author presentations as Markdown and build them into static web apps, Code Engine Functions take care of building and serving that content without requiring infrastructure management, and GitHub Actions ties it all together with automated CI/CD.

1. Make sure you have a [IBM Cloud account](https://cloud.ibm.com/) to access Code Engine and related services. For proof-of-concept or initial experimentation, you can simply create an IBM Cloud API key to authenticate your workflows. However, for production-grade setups, it's recommended to use a service ID API key for better security and separation of concerns. To do this, navigate to [Manage → Access (IAM) → Service IDs](https://cloud.ibm.com/iam/serviceids), create a new service ID, assign it access to your resource group along with Code Engine and Container Registry permissions, and then generate and securely store the associated API key for use in your workflows. See the [documentation](https://cloud.ibm.com/docs/iam?topic=iam-serviceidapikeys) for additional information.

2. Next, set up your GitHub repository by storing your IBM Cloud API key as a secret so it can be securely used by your deployment workflow. Regardless of whether you are using a personal API key or a service ID API key, navigate on GitHub to your repository settings under Settings → Secrets and variables → Actions, create a new secret (for example, `IBM_IAM_API_KEY`), and paste the API key you generated earlier. This allows your GitHub Actions workflow to authenticate with IBM Cloud and deploy your Code Engine function automatically.

3. Now you can create the project structure.Start by adding the three SPA function wrapper files [main.js](https://github.com/IBM/CodeEngine/blob/main/function-spa/main.js), [package.json](https://github.com/IBM/CodeEngine/blob/main/function-spa/package.json), and [build-spa.sh](https://github.com/IBM/CodeEngine/blob/main/function-spa/build-spa.sh) into the repository directory. These files are the reusable SPA function asset from our [previous post](https://ibm.github.io/CodeEngine/posts/serverless-spa-deployment-with-code-engine-functions/) `build-spa.sh` builds the Slidev project into a static SPA, and `main.js` serves it as a Code Engine Function over HTTP. No changes to these files are needed.

4. Next, initialize your Slidev project. The following command `npm init slidev@latest my-presentation` generates a `my-presentation` directory containing your `slides.md` file along with the supporting Slidev project files.

5. Finally, add the GitHub Actions workflow file at `.github/workflows/deploy-func-slides.yml` to enable automated deployment.

Your directory structure should now look like this:
```bash
├── my-presentation/              # Slidev project
├── main.js                       # Code Engine function entry point
├── package.json                  # Runtime dependencies for the function
├── build-spa.sh                  # Build script executed by Code Engine
└── .github/
    └── workflows/
        └── deploy-func-slides.yml
```

Your GitHub Actions workflow should define an automated deployment that builds your Slidev presentation from the repository and deploys it as a Code Engine function whenever changes are pushed to `main`. You simply configure the required parameters such as your API key (`IBM_IAM_API_KEY`), target project, runtime, and source directory so that updates to your repository are automatically reflected in a live deployment. For more details and advanced configuration options, refer to the official Code Engine GitHub Action [documentation](https://github.com/marketplace/actions/code-engine-github-action).

```yaml
name: Deploy Slidev Presentation to Code Engine

on:
  push:
    branches:
      - main

jobs:

  slidev-func:
    runs-on: ubuntu-latest
    steps:
    - name: Check out code
      uses: actions/checkout@v3

    - name: Deploy Presentation Function
      uses: IBM/code-engine-github-action@v1
      with:
        api-key: ${{ secrets.IBM_IAM_API_KEY }}
        region: 'eu-de'           # Change to your target region
        project: 'my-ce-project'
        component: 'fn'
        runtime: nodejs-24
        name: 'my-presentation'
        build-source: '.'
```


## Creating your Presentations

With everything set up, you can now focus entirely on creating your presentation. Navigate into the `./my-presentation` directory and open `slides.md` this is the file that contains all of your slides. Each slide is separated by `---` and written in standard Markdown. You can preview your changes locally by running the development server:

```bash
cd my-presentation
npm run dev
```

This provides instant feedback in the browser as you edit. Once you're happy with the result, just commit and push your changes to the `main` branch—your presentation will be automatically rebuilt and deployed, ensuring that what you see locally is exactly what goes live. For more advanced features and customization options, be sure to explore the [Slidev documentation](https://sli.dev/guide/) to create engaging and interactive presentations.


## Conclusion

In summary, this approach creates a fully automated and serverless pipeline where everything—from building to deployment—happens in the background. Every time you update `slides.md` and push your changes, GitHub Actions triggers the workflow, Code Engine builds your Slidev project, and your function is deployed or updated automatically. The result is a streamlined, developer-friendly experience with no manual builds, no infrastructure to manage, and no deployment scripts—just Markdown pushed to GitHub and a live presentation URL moments later. This makes it a great fit for demos, workshops, technical talks, and internal knowledge sharing, and it extends the idea of easy SPA deployment into something even more powerful: turning content itself into the deployment unit.

Ready to try it yourself? Grab the [SPA function wrapper files](https://github.com/IBM/CodeEngine/tree/main/function-spa) from the Code Engine sample repository, follow the steps above, and have your first Slidev presentation live on Code Engine in under ten minutes. Or check out our other samlples or previous blogs.

- [Code Engine](https://www.ibm.com/products/code-engine)
- [Code Engine Docs](https://cloud.ibm.com/docs/codeengine)
- [Code Engine Sample Repository](https://github.com/IBM/CodeEngine)
- [Slidev](https://sli.dev/)
- [The Serverless Way to Auto-Build and Deploy React, Angular, and Any SPA with IBM Cloud Code Engine Functions](https://ibm.github.io/CodeEngine/posts/serverless-spa-deployment-with-code-engine-functions/)
- [Code Engine Github Action](https://github.com/marketplace/actions/code-engine-github-action)
- [IBM Cloud Code Engine: Deploying Apps, Jobs and Functions using GitHub Actions](https://ibm.github.io/CodeEngine/posts/deploying-apps-jobs-and-functions-using-github-actions/)
- [IBM Cloud Code Engine GitHub Action: Getting into the Cloud just got a lot easier!](https://ibm.github.io/CodeEngine/posts/getting-into-the-cloud-just-got-a-lot-easier/)