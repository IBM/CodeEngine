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

## Further information

- [Language Technology Research Group at the University of Helsinki @ Huggingface](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)
- [Next.js Flask Starter](https://vercel.com/templates/next.js/nextjs-flask-starter)
