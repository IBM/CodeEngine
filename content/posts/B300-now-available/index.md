---
title: "NVIDIA B300 GPUs Now Available in IBM Cloud Code Engine Serverless Fleets"
date: 2026-05-26
description: "B300 GPUs now available in IBM Cloud Code Engine."
tags: ["serverless", "code engine", "GPU", "AI", "serverless fleets", "news"]
featureImage: "featured.jpg"
draft: false
authors: "uwefassnacht"
---

The AI landscape is moving at a breakneck pace, and today we are shifting into a new gear. We are thrilled to announce that NVIDIA B300 (Blackwell Ultra) GPUs are now also available in IBM Cloud Code Engine Serverless Fleets.

By bringing NVIDIA’s most powerful Blackwell-architecture GPU to our serverless platform, we are giving developers the ability to run the world’s most demanding reasoning models and massive-scale simulations without the burden of infrastructure management.

### Why Use B300 with Serverless Fleets?

- “Serverless Fleets" make the B300 accessible and cost-effective. While Blackwell GPUs are power-hungry (1,400W TDP) and expensive to reserve, Code Engine changes the economics:

- Zero Idle Costs: The B300 is a high-performance asset. In a traditional setup, you pay for it 24/7. With Code Engine, your Fleet scales to zero when your job is done. Billing starts the moment a GPU is initialized, and you are only charged for the GPU‑seconds it is active.

- Massive Parallelism without the Headaches: Serverless Fleets allow you to submit thousands of tasks to a single endpoint. Code Engine automatically provisions the B300 resources, distributes the tasks, and decommissions the GPUs when the work is complete.

- Blackwell-Ready Abstraction: No need to configure liquid cooling or 800Gbps networking. We handle the intense infrastructure requirements of the Blackwell architecture so you can focus on your vllM or PyTorch code.

- Seamless Model Fitting: The massive 288GB VRAM means you can run larger batch sizes or longer context windows (up to 128k+ tokens) on a single node, significantly reducing the latency overhead of inter-GPU communication.

### Ready to Scale?

Whether you are fine-tuning the latest Granite models or running high-throughput inference for a global application, the B300 on Code Engine is your new high-performance home.

- Get Started: View the [Code Engine Serverless Fleets documentation](https://cloud.ibm.com/docs/codeengine?topic=codeengine-cefleets) to learn how to configure your first GPU-enabled fleet.

- Step-by-Step Tutorial: Follow our [GPU Batch Processing tutorials on GitHub](https://github.com/IBM/CodeEngine/tree/main/serverless-fleets) for real-world examples.

- Pricing & Profiles: Visit the [IBM Cloud Pricing Page](https://cloud.ibm.com/containers/serverless/overview) to see the latest rates for B300 GPU-second billing and choose the right worker profile for your workload.

**The era of Blackwell has arrived. Scale your intelligence, not your operations.**
