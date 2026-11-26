# Inbound Webhooks for a Network-Isolated Code Engine Project

This sample shows how a network-isolated (private, CBR-restricted) Code Engine project can receive webhooks from the public internet. A sender such as GitHub cannot call a network-isolated project directly. Instead, a small public project verifies and stores each delivery, and the private project picks it up from there. GitHub is used as the example sender, but the pattern works for any webhook.

```
sender ──HTTPS──▶ receiver (public project) ──write──▶ COS bucket ──event──▶ consumer (private project, CBR)
```

* **receiver** (public project): a Code Engine function that verifies the HMAC signature and writes the delivery as an object to a Cloud Object Storage (COS) bucket. It only has write access to that bucket, and its project allows no outbound traffic except to IBM Cloud services over their private endpoints.
* **consumer** (isolated project): triggered by a COS event subscription for every new object, reads it and processes it (the sample logs a summary). It only has read access to that bucket and accepts no inbound traffic at all, because a context-based restriction (CBR) rule denies the public and the private endpoint.

Receiver and consumer authenticate to COS with IAM trusted profiles, so there are no API keys. The sender-specific code (header names, signature scheme) is marked in [`src/receiver/main.js`](src/receiver/main.js). Adapt it to use another sender.

**Payload size limit:** Code Engine functions accept request bodies of up to 5 MB, while GitHub sends up to 25 MB. A delivery above the limit is rejected by Code Engine before the function runs, so it is dropped: nothing is written to the bucket, the consumer never sees it, and the receiver does not log it. The sender is told that the delivery failed (GitHub shows it as failed under *Settings > Webhooks > Recent Deliveries*), and redelivering it fails again. Typical events such as pushes, issues and pull request activity are far smaller, but a push with many commits or a large pull request payload can exceed the limit. If you must receive such payloads, run the receiver as an application instead of a function.


## Prerequisites

[IBM Cloud CLI](https://cloud.ibm.com/docs/cli) with the `code-engine`, `cloud-object-storage` and `cbr` plugins, plus `jq`, `curl`, `openssl` and `uuidgen`. Docker is only needed to build your own images (see below), Node.js 24 or later only to run the unit tests of the receiver.

```
ibmcloud plugin install -f code-engine cloud-object-storage cbr
ibmcloud login
```

## Installing the sample

1. Set the secret that your sender signs its webhooks with (it is not stored in any file), then deploy. The names and the region are documented with their defaults at the top of [`run`](run). Override any of them with an environment variable, for example `REGION=us-south ./run`. The receiver code bundle and the consumer image are pulled from `icr.io/codeengine/webhook-sample` unless you set `RECEIVER_REGISTRY` and `CONSUMER_REGISTRY`.
    ```
    read -rs WEBHOOK_SECRET && export WEBHOOK_SECRET
    ./run
    ```

2. Configure the webhook of your sender with the URL that `./run` prints, content type `application/json` and the same secret. For GitHub, add it under *Settings > Webhooks* of your repository.

3. Check that it works. The first command sends a signed and several invalid requests to the receiver, the second shows the deliveries that the consumer processed. The logs of the receiver function are available in IBM Cloud Logs.
    ```
    ./test-receiver
    ibmcloud ce project select --name webhook-isolated && ibmcloud ce app logs --name webhook-consumer
    ```

When you do not need the sample anymore, delete everything:

```
./run clean
```

`./run clean` deletes everything that `./run` created, except the resource group, without asking.

## Using your own images

Both components are built outside of Code Engine with Docker, each with the `Dockerfile` in its source directory. The consumer ([`src/consumer/Dockerfile`](src/consumer/Dockerfile)) is a regular container image. The receiver is a function, so its image is a code bundle: [`src/receiver/Dockerfile`](src/receiver/Dockerfile) installs the dependencies of [`src/receiver`](src/receiver) and puts `main.js` and `node_modules` into a single layer, which Code Engine runs with its managed Node.js runtime. Build and push both images to your own registry and namespace, then deploy with the same registry and namespace. The receiver code bundle is named `<RECEIVER_REGISTRY>/receiver` and the consumer image `<CONSUMER_REGISTRY>/consumer`, where both variables hold `<registry>/<namespace>` and may differ.

```
RECEIVER_REGISTRY=<registry>/<namespace> CONSUMER_REGISTRY=<registry>/<namespace> ./build
RECEIVER_REGISTRY=<registry>/<namespace> CONSUMER_REGISTRY=<registry>/<namespace> ./run
```

If the registry is private, create a registry secret for it in both projects. Add it to the consumer with `ibmcloud ce app update --registry-secret <secret>` and to the receiver with `ibmcloud ce function update --code-bundle-secret <secret>`.

The unit tests of the receiver run with `npm ci && npm test` in [`src/receiver`](src/receiver).
