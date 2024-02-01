## Introduction

This is a hybrid Next.js + Python app that uses Next.js as the frontend and Flask as the API backend. One great use case of this is to write Next.js apps that use Python AI libraries on the backend.

## Local Development

Install all Node.js dependencies
```
npm install
```

Clone the Hugging Face models into the local file system
```
git clone https://huggingface.co/Helsinki-NLP/opus-mt-de-en
(cd opus-mt-de-en && rm README.md rust_model.ot && rm -rf .git)
```

Start the Python backend and the Next.js app in development mode
```
npm run dev
```

Open the browser http://localhost:8080/


## Deployment on Code Engine

```
ibmcloud ce app create \
    --name my-translator \
    --build-source . \
    --build-size xlarge \
    --ephemeral-storage 4G \
    --memory 4G \
    --cpu 2 \
    --scale-down-delay 600 \
    --probe-ready type=http \
    --probe-ready path=/api/ping \
    --probe-ready interval=5 \
    --probe-ready initial-delay=10 \
    --probe-ready timeout=3
```

To help understand what we are passing in as our configuration, here are a couple explanations:

- `build-source` & `build-size`: Since we are creating an image based on local source code, we signal that by setting the `build-source` to our file context. To read more about this topic, visit [Deploying your app from local source code with the CLI](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-local-source-code) in our documentation. The size 
- `ephemeral-storage`: It is important for our use-case to set the `ephemeral-storage`. Our application including the model would exceed the default of 400MB, resulting in an error.
- `cpu` & `memory`: We want to provide enough resources to handle a good amount of requests simultaneously. Also keep in mind that the `ephemeral-storage` can be set to the maximum value of what we have as `memory`. To see a comprehensive list of all possible combinations, visit [Supported memory and CPU combinations](https://cloud.ibm.com/docs/codeengine?topic=codeengine-mem-cpu-combo)
- `min-scale`: With it being set to `0`, the application will scale down to 0 instances, reducing costs, when it is not being used. More information on application scaling can be found in the documentation page [Configuring application scaling](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-scale).
- `scale-down-delay`: One downside of `min-scale: 0` is that the application takes some time to scale up, when it hasn’t been used. To remediate that, adding `scale-down-delay` delays this scale-down, in our case by 600 seconds.
- `probe-ready`: Our Next.js front-end application becomes ready quite fast, while our Python Flask API takes a bit of time. To make sure we only show our UI when everything is in working order, we have to wait for our API service. This is where the readiness probe comes into play. It waits for our introduced “/api/ping” endpoint to work correctly, before the app is considered “ready” and can actually translate text. More information on probes can be found on our documentation page [Working with liveness and readiness probes for your app](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-probes).

## Further information

- [Language Technology Research Group at the University of Helsinki @ Huggingface](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)
- [Next.js Flask Starter](https://vercel.com/templates/next.js/nextjs-flask-starter)
