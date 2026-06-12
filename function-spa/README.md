# Serve Static Web Apps as IBM Code Engine Functions

This sample demonstrates how to package and serve static web applications (SPAs) as IBM Code Engine functions. It's designed for scenarios where a full Code Engine application is unnecessary: small static bundles, internal tools, previews, demos, or packaged customer-specific frontends.

## Overview

The function serves static files from a `dist/` directory with intelligent routing:
- Direct file serving for existing assets
- Fallback to `index.html` for client-side routing
- Proper cache headers (long-lived for assets, no-cache for HTML)
- Support for binary files (images, fonts, videos)

## Prerequisites

- IBM Cloud CLI with Code Engine plugin
- Node.js 18 or later
- A frontend project that builds to static files

## Repository Structure

```text
.
├── main.js              # Function entrypoint
├── package.json         # Function package definition
├── build-spa.sh         # Build script (runs during deployment)
├── run-angular          # Quick-start script for Angular
├── run-react            # Quick-start script for React
└── run-svelte           # Quick-start script for Svelte

```

## Quick-Start use a Framework 

Create and deploy a new Angular, React, or Svelte project:

```bash
# For Angular
./run-angular

# For React
./run-react

# For Svelte
./run-svelte
```

Each script creates a new project, builds it, and deploys it as a Code Engine function.

## Local Development Workflow

You can create any Single Page Application in this project and develop it locally using your normal workflow (e.g., hot reload, dev server, etc.). Once you're ready to deploy:

1. **Develop locally** - Use your framework's development server and tools as usual
2. **Test your build** - Ensure `npm run build` produces static files in `dist/` or `build/`
3. **Deploy** - Run the function create or update command to deploy to Code Engine

The build process automatically handles packaging your static files into the function during deployment.

## How It Works

### Build Process

When you deploy to Code Engine, the build process:

1. **Detects your frontend** - `build-spa.sh` finds the first non-hidden directory (excluding `node_modules` and `dist`)
2. **Installs dependencies** - Runs `npm ci` or `npm install`
3. **Builds the frontend** - Executes `npm run build`
4. **Locates output** - Finds `index.html` in either `dist/` or `build/`
5. **Copies to root** - Places build artifacts in root `dist/` directory
6. **Cleans up** - Removes the source frontend directory

The function package includes only `main.js`, `package.json`, and `dist/`.

### Request Handling

The function in `main.js`:

1. Extracts the request path from `__ce_path`
2. Sanitizes the path to prevent directory traversal
3. Attempts to serve the requested file directly from `dist/`
4. Falls back to `index.html` for paths without extensions (client-side routing)
5. Returns 404 for missing asset files

### Cache Strategy

- `index.html`: `Cache-Control: no-cache` (always check for updates)
- All other files: `Cache-Control: public, max-age=31536000` (1 year)

This assumes your build process generates content-hashed filenames for assets.

## Deployment

### Create a New Function

```bash
ibmcloud ce function create \
  --name my-static-app \
  --runtime nodejs-24 \
  --build-source .
```

### Update an Existing Function

```bash
ibmcloud ce function update \
  --name my-static-app \
  --build-source .
```

### Get Function URL

```bash
ibmcloud ce function get --name my-static-app
```

The function URL will be in the output under "URL".
