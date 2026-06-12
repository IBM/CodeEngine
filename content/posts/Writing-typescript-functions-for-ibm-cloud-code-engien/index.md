---
title: "Writing TypeScript Functions for IBM Cloud Code Engine"
date: 2025-08-04
description: "Writing TypeScript Functions for IBM Cloud Code Engine"
tags: ["serverless", "code engine", "functions", "typescript"]
featureImage: "featured.jpg"
draft: false
authors: ["luke-roy-ibm"]
---

[IBM Cloud Code Engine](https://www.ibm.com/products/code-engine) is IBM’s serverless platform that allows developers to run apps, jobs, and functions at scale — without the hassle of managing infrastructure. Among its workload types are functions, which currently support Node.js and Python runtimes.
In this post, we’ll explore how to write a TypeScript function and deploy it as a Node.js function on IBM Cloud Code Engine. This approach lets you enjoy the benefits of TypeScript — like static typing and modern language features — while still running your function as JavaScript.

TypeScript is a superset of JavaScript that adds optional static typing and other powerful features. It helps catch bugs early and improves code maintainability. However, IBM Cloud Code Engine functions expect JavaScript files, so we need to transpile our TypeScript code to JavaScript before deployment.

Let’s walk through setting up a simple TypeScript-based function that uses a third-party module. The Code can be found in the following [GitHub Repository](https://github.com/IBM/CodeEngine/tree/main/helloworld-samples/function-typescript-codebundle-nodejs)

## 1. Create your main function file in TypeScript

Write your function logic in index.ts. For example, the following function imports the lorem-ipsum module and returns a randomly generated paragraph:

```javascript
import { LoremIpsum } from "lorem-ipsum";

interface Params {
  [key: string]: any;
}
interface Response {
  headers: { [key: string]: string };
  body: string;
}
export function main(params?: Params): Response {
  const lorem = new LoremIpsum();
  return {
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: lorem.generateWords(10),
  };
}
```
## 2. Set up your package.json

Define your dependencies and scripts. Include TypeScript as a devDependency, and use the postinstall script to transpile your TypeScript code to JavaScript automatically after installation:

```json
{
  "name": "ts-func",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "postinstall": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.9.2"
  },
  "dependencies": {
    "lorem-ipsum": "^2.0.8"
  }
}
```

## 3. Create a tsconfig.json file

This configuration tells TypeScript how to transpile your code:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
  }
}
```

## 4. Deploy your function to IBM Cloud Code Engine

After setting up all required files (index.ts, package.json, and tsconfig.json), navigate to your project directory and use the IBM Cloud CLI to create or update your function. Since TypeScript is listed as a devDependency and the tsc command is defined in the postinstall script, IBM Cloud Code Engine will automatically run the TypeScript compiler during its build process — saving you the effort of manually transpiling your code.

```bash
ibmcloud ce fn create --name ts-func --runtime nodejs-22 --build-source .
```

You’ve now successfully created a Node.js function for IBM Cloud Code Engine — while taking full advantage of TypeScript’s type safety and modern features. Give it a try in your next project and experience the benefits of cleaner, more reliable serverless code.