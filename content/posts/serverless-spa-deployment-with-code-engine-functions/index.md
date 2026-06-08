---
title: "The Serverless Way to Auto-Build and Deploy React, Angular, and Any SPA with IBM Cloud Code Engine Functions"
date: 2026-06-08
description: "Learn how to deploy Single Page Applications (SPAs) to IBM Cloud Code Engine Functions with automatic builds during deployment. No manual build steps, no infrastructure management—just point Code Engine at your source code and deploy."
tags: ["serverless", "code engine", "functions", "spa", "react", "angular", "svelte"]
draft: false
authors: ["luke-roy-ibm", "josip-ledic"]
---

# The Serverless Way to Auto-Build and Deploy React, Angular, and Any SPA with IBM Cloud Code Engine Functions

[IBM Cloud Code Engine](https://www.ibm.com/products/code-engine) is IBM's serverless platform that allows developers to run applications, batch jobs, and functions at scale, without the hassle of managing infrastructure. It automatically handles provisioning, scaling, networking, and security, letting you focus on writing code instead of managing servers.

Among its workload types are **[functions](https://cloud.ibm.com/docs/codeengine?topic=codeengine-cefunctions)**, which provide a lightweight, event-driven execution model. Code Engine functions currently support Node.js and Python [runtimes](https://cloud.ibm.com/docs/codeengine?topic=codeengine-fun-runtime), making them ideal for serving APIs, processing events or, as we'll explore in this post serving static web content.

When deploying Single Page Applications (SPAs) to the cloud, you typically face a choice: use a full application server with all its overhead, or manually build your frontend and figure out how to serve static files. What if you could skip both the complexity and the manual steps?

Code Engine Functions offer a compelling middle ground. Serverless, pay-per-use, and surprisingly simple for static content. But the real magic happens when you eliminate the build step from your deployment workflow entirely.

In this post, we'll explore how to deploy any Single Page Application—whether it's Angular, React, Svelte, Vue, or any other framework—as a Code Engine function. This approach lets you enjoy the benefits of serverless deployment—automatic scaling, pay-per-use pricing, and zero infrastructure management—while keeping your deployment workflow dead simple: just point Code Engine at your source code, and it handles the build automatically.

## The Problem with Traditional SPA Deployment

Most SPA deployment workflows look like this:

1. Build your frontend locally (`npm run build`)
2. Upload the build artifacts to object storage or a CDN
3. Configure routing rules for client-side navigation
4. Set up cache headers manually
5. Hope you didn't forget to rebuild before deploying

This works, but it's error-prone. You might deploy stale builds, forget to update dependencies, or misconfigure cache headers. And if you're working with multiple frameworks or projects, each one has its own quirks.

## A Better Approach: Build During Deployment

What if the build happened automatically during deployment, using the exact source code you're deploying? That's the approach this solution takes.

Here's the complete deployment flow:

```bash
# Create a new function
ibmcloud ce function create \
  --name my-static-app \
  --runtime nodejs-24 \
  --build-source .

# Or update an existing one
ibmcloud ce function update \
  --name my-static-app \
  --build-source .
```

That's it. No separate build step. No manual file copying. Just point Code Engine at your repository, and it handles the rest.

## How It Works

### Prerequisites

Before you begin, make sure you have:

- **IBM Cloud account** with Code Engine access ([IBM Cloud account](https://cloud.ibm.com/registration), )
- **Code Engine project** created in your IBM Cloud account ([Code Engine getting started](https://cloud.ibm.com/docs/codeengine?topic=codeengine-getting-started))
- **IBM Cloud CLI & Code Engine CLI plugin** installed and configured ([installation guide](https://cloud.ibm.com/docs/cli))
- **Basic familiarity** with npm and your chosen frontend framework

### The Function Wrapper

The magic happens thanks to a simple function wrapper that we provide, consisting of just three files. These files are included in the [Code Engine Sample repository](https://github.com/IBM/CodeEngine/tree/main/function-spa):

1. **`main.js`** - The function entrypoint that serves your static files
2. **`package.json`** - The function definition with a postinstall hook
3. **`build-spa.sh`** - The build script that runs during deployment

When you deploy to Code Engine, you're actually deploying this function wrapper alongside your SPA source code. The wrapper handles everything: building your frontend, serving the files, routing requests, and setting cache headers.

From a development perspective, your repository structure looks like this:

```
your-repo/
├── main.js              # As provided from the Repo (serves static files)
├── package.json         # As provided from the Repo (with postinstall hook)
├── build-spa.sh         # As provided from the Repo (runs during deployment)
└── my-frontend/         # Your SPA source code folder
    ├── package.json     # Frontend dependencies
    ├── src/             # Frontend source files
    └── ...              # Other frontend files
```

The root contains the function wrapper files ([main.js](https://github.com/IBM/CodeEngine/blob/main/function-spa/main.js), [package.json](https://github.com/IBM/CodeEngine/blob/main/function-spa/package.json) and [build-spa.sh](https://github.com/IBM/CodeEngine/blob/main/function-spa/build-spa.sh)), and your SPA lives in a subdirectory. During deployment, the build script automatically detects your frontend folder, builds it, and places the output in the root `dist/` directory.

**These three function wrapper files (`main.js`, `package.json`, and `build-spa.sh`) can be directly copied and used for your own SPA projects without modification.** They're designed to be framework-agnostic and work out of the box with any frontend that builds to static files. If you have specific requirements—such as custom routing logic, additional MIME types, or different build output locations—you can adapt these files to suit your needs while maintaining the core deployment workflow.

The secret is in the `package.json` postinstall hook:

```json
{
  "name": "static-content-function",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "postinstall": "./build-spa.sh"
  }
}
```

When Code Engine builds your function, it runs `npm install`. After installation completes, the postinstall hook triggers `build-spa.sh`, which:

1. **Detects your frontend** - Finds the first non-hidden directory (excluding `node_modules` and `dist`)
2. **Installs dependencies** - Runs `npm ci` or `npm install` in that directory
3. **Builds the frontend** - Executes `npm run build`
4. **Locates output** - Finds `index.html` in either `dist/` or `build/`
5. **Copies to root** - Places build artifacts in the root `dist/` directory
6. **Cleans up** - Removes the source frontend directory to keep the function package small

The final function package contains only three things:

```
function-package/
├── main.js         # Function entrypoint
├── package.json    # Function definition
└── dist/           # Your built frontend
    ├── index.html
    ├── assets/
    └── ...
```

At runtime, the function serves files directly from `dist/` when they exist, falls back to `index.html` for paths without extensions (enabling client-side routing), and returns 404 for missing assets. Binary files like images and fonts are automatically base64-encoded, while path traversal attempts are sanitized and only GET requests are allowed for security.

## Using Any Frontend Framework

This approach works with any frontend framework or build tool that produces static files.

### Quick Start

To get started quickly:

1. **Clone the repository**
   ```bash
   git clone https://github.com/IBM/CodeEngine.git
   cd CodeEngine/function-spa
   ```

2. **Add your SPA to a subdirectory**
   - Place your frontend project in a subdirectory (e.g., `my-app/`)
   - Ensure it has `npm run build` configured in its `package.json`

3. **Deploy to Code Engine**
   ```bash
   ibmcloud ce function create --name my-app --runtime nodejs-24 --build-source .
   ```

**Or use the included quick-start scripts:**

The repository includes three quick-start scripts demonstrating the workflow:

```bash
./run-angular  # Creates Angular project (SSR disabled, routing enabled, standalone components)
./run-react    # Creates React project with Vite (TypeScript, fast builds, modern tooling)
./run-svelte   # Creates Svelte project with Vite (minimal bundle, reactive components)
```

Each script creates a new project in a subdirectory, checks if the function already exists, runs either `function create` or `function update`, and waits for deployment to complete. These examples show that whether you're using Angular, React, Svelte, Vue, Solid, Qwik, or any other framework, the deployment process is identical.

To use your own frontend, it must meet these requirements:

1. **Produces static files** - The output must be plain HTML, CSS, and JavaScript
2. **Has a build script** - Must have `npm run build` in `package.json`
3. **Outputs to `dist/` or `build/`** - The build script should create one of these directories
4. **Includes `index.html`** - The build output must contain an `index.html` file

The deployment workflow is straightforward:

1. Create your SPA project in a subdirectory alongside the function wrapper files (`main.js`, `package.json`, `build-spa.sh`)
2. Develop locally using your framework's dev server
3. Test that `npm run build` works and produces the expected output
4. Deploy with `ibmcloud ce function create` or `update`

The build process automatically detects your frontend, builds it during deployment, and packages everything correctly.
This approach doesn't interfere with your local development workflow—you can continue using your framework's hot reload, dev server, and all existing best practices and tooling.
Simply develop locally as usual, test that `npm run build` produces static files, then deploy with the Code Engine command. You never need to manually copy files or worry about build artifacts; the deployment process handles everything.

## Conclusion

Deploying SPAs to Code Engine Functions eliminates the manual build step while keeping your deployment simple and cost-effective. The build happens automatically during deployment, using the exact source code you're deploying. The function runtime is minimal, secure, and handles all the routing and caching logic you need.

Whether you're deploying an Angular dashboard, a React demo, or a Svelte tool, the workflow is the same: develop locally, then deploy with a single command. No build artifacts to manage, no manual file copying, no configuration drift.

Code Engine Functions offer a sweet spot between different deployment options. Compared to Code Engine Applications, functions are more cost-effective for low-traffic SPAs since you only pay per invocation rather than for always-running containers, and functions have fast cold starts. Compared to Object Storage with CDN, functions automate the build process and handle routing in code, eliminating manual builds and complex routing configuration. And compared to traditional hosting with fixed monthly costs and server management overhead, functions provide pay-per-use pricing with automatic deployment and zero server management.

This approach is ideal for internal tools, demos and previews, customer-specific frontends, small static bundles, and cost-sensitive projects. However, it's not suited for applications requiring server-side rendering (SSR), backends with complex API logic (use Code Engine applications instead), sites with extremely high traffic (consider a CDN), or applications needing WebSocket connections or long-running processes.

The complete source code is available at the [Code Engine Sample Repository](https://github.com/IBM/CodeEngine/blob/main/function-spa), including the quick-start scripts for Angular, React, and Svelte. 
Now its your turn try it out and see how simple SPA deployment can be.

---

*This approach works with any frontend framework that builds to static files. The examples use Angular, React, and Svelte, but Vue, Solid, Qwik, and others work just as well.*
