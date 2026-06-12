---
title: "Upscaling Videos with IBM Cloud Code Engine Serverless Fleets"
date: 2025-10-07
description: "Upscaling Videos with IBM Cloud Code Engine Serverless Fleets"
tags: ["serverless", "code engine", "GPU", "AI", "serverless fleets", ]
featureImage: "featured.jpg"
draft: false
authors: ["luke-roy-ibm"]
---

[IBM Cloud Code Engine](https://www.ibm.com/products/code-engine) is IBM’s fully managed, strategic serverless platform that empowers developers to run container images, batch jobs, source code, and functions — all in one unified environment. It abstracts away the complexity of infrastructure management, automatically handling scaling, networking, and security so you can focus on building and deploying your applications.
With the introduction of [Serverless Fleets](https://www.ibm.com/new/announcements/ibm-cloud-code-engine-introduces-serverless-fleets-with-gpus), IBM Cloud Code Engine now supports large-scale, parallel execution of run-to-completion tasks across multiple virtual machines — securely hosted within your own [Virtual Private Cloud](https://www.ibm.com/solutions/vpc) (VPC). This gives you the flexibility to define custom subnets and choose from a wide range of [Virtual Server Instance](https://www.ibm.com/products/virtual-servers) (VSI) flavors, including GPU-enabled options, tailored to your workload’s performance needs.
What sets Code Engine apart is its serverless nature — it abstracts away the operational complexity of infrastructure management. You don’t need to worry about provisioning, scaling, or securing the underlying compute resources. Instead, you can focus entirely on your application logic and task definitions, while Code Engine handles the orchestration behind the scenes.
By running Code Engine Serverless Fleets in a single-tenant environment, you gain enhanced control over performance, security, and compliance. This architecture ensures that your workloads execute in isolated infrastructure, making it ideal for enterprise-grade use cases such as video processing, AI inference, and scientific computing — all with a streamlined developer experience. Check out the [introduction](https://www.ibm.com/new/announcements/ibm-cloud-code-engine-introduces-serverless-fleets-with-gpus) to Code Engine Serverless Fleets or look at the [documentation](https://cloud.ibm.com/docs/codeengine?topic=codeengine-cefleets).

In this blog post, we’ll explore a hands-on use case: upscaling video files using the [Video2X](https://docs.video2x.org/) framework powered by Real-ESRGAN, orchestrated entirely through IBM Cloud Code Engine Serverless Fleets with GPU support.

To follow along with this tutorial, you’ll need to have several IBM Cloud resources set up. These include an activated [IBM Cloud account](https://cloud.ibm.com/login), a [Code Engine](https://cloud.ibm.com/docs/codeengine?topic=codeengine-getting-started) project, and an [IBM Cloud Object Storage](https://www.ibm.com/products/cloud-object-storage) instance configured with three COS buckets, each supporting built-in encryption and multi-region capabilities. The first bucket stores the data required to run your IBM Cloud Code Engine Serverless Fleets, the second holds the input files used by the fleet, and the third one is used to store the output files. Additionally, you’ll need a Virtual Private Cloud (VPC) with appropriately configured subnets.

To simplify the setup process, we’ll be using a one-time configuration script available in the following [GitHub repository](https://github.com/IBM/CodeEngine/tree/main/serverless-fleets), which automatically provisions and configures all the required IBM Cloud resources. This approach is ideal for users who are new to Code Engine Serverless Fleets or want a [quick start](https://github.com/IBM/CodeEngine/tree/main/serverless-fleets#one-time-setup). However, if you’re already familiar with Code Engine and have an existing environment, feel free to customise or integrate the example setup to suit your current infrastructure.


## Upscaling the videos

Now that all the prerequisites for running Serverless Fleets on IBM Cloud Code Engine are in place, we can begin preparing our video upscaling use case. Start by uploading your video files to the designated COS input bucket. You can use the IBM Cloud UI, or any tool you’re comfortable with — such as rclone or other file transfer utilities. For consistency, we’ll store the uploaded videos in the COS input bucket using the prefix `/videos`. Once processed, the upscaled output files will be saved in the COS output bucket, also under the `/videos` prefix. This structure helps keep your input and output data organized and easy to manage.
Become a Medium member

With your video files now available in the COS input bucket, the next step is to create a `videos.jsonl` file. This file serves as a task list for the fleet, where each line contains a JSON object that defines how a specific video should be processed. Each task entry includes the necessary metadata and instructions for handling one video. For example, if you have eight videos to upscale, your `videos.jsonl` file might look something like this, with one line per video task.

```json
{ "args": ["--input", "/input/video-1.mp4", "--output", "/output/video-1-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
{ "args": ["--input", "/input/video-2.mp4", "--output", "/output/video-2-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
{ "args": ["--input", "/input/video-3.mp4", "--output", "/output/video-3-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
{ "args": ["--input", "/input/video-4.mp4", "--output", "/output/video-4-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
{ "args": ["--input", "/input/video-5.mp4", "--output", "/output/video-5-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
{ "args": ["--input", "/input/video-6.mp4", "--output", "/output/video-6-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
{ "args": ["--input", "/input/video-7.mp4", "--output", "/output/video-7-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
{ "args": ["--input", "/input/video-8.mp4", "--output", "/output/video-8-upscale.mp4", "--processor", "realesrgan", "--scaling-factor", "4", "--realesrgan-model","realesrgan-plus"]}
```

Explanation of Parameters:

- **--input**: Path to the input video file (input bucket mounted from COS)
- **--output**: Path where the upscaled video will be saved (output bucket mounted from COS)
- **--processor**: Specifies the upscaling engine (e.g. realesrgan)
- **--scaling-factor**: Determines the upscale factor (e.g., 2x, 4x)
- **--realesrgan-model**: Chooses the model variant (e.g., realesrgan-plus for live-action content)

Dive into the [Video2X GitHub repository](https://github.com/k4yt3x/video2x/) and its [documentation](https://docs.video2x.org/) to explore alternative engines and models. This will allow you to fine-tune processing parameters and achieve optimal upscaling results tailored to your specific use case.

Now that your videos and tasks are prepared, it’s time to launch the fleet using IBM Cloud Code Engine. You can do this via the Code Engine UI or the CLI. In this example, we’ll use the CLI to run the Code Engine Serverless Fleets with the official Video2X container image (`ghcr.io/k4yt3x/video2x:6.4.0`). The Code Engine Serverless Fleets will be configured to process tasks defined in the `videos.jsonl` file, with two tasks running in parallel. Of course, this setup is fully customizable—you can scale the number of concurrent tasks, adjust resource allocations, and process as many videos as you upload and define.
Each task will be allocated substantial resources -- `20 CPU cores`, `100 GB of RAM`, and an `NVIDIA L40 GPU` -- ensuring high-performance video upscaling. Since the maximum scale is set to two, Code Engine will provision two worker VSIs to handle the tasks concurrently, with each worker processing one video at a time.
The `--tasks-state-store` parameter points to a persistent COS bucket used to manage the operational state of the Code Engine Serverless Fleets. Additionally, the `--mount-data-store` options mount the input and output COS buckets into the container: the input bucket with the prefix `/videos` is mounted at `/input`, and the output bucket with the prefix `/videos` is mounted at the path `/output` inside the container.

```bash
ibmcloud code-engine fleet create --name “upscale-videos” \
--image "ghcr.io/k4yt3x/video2x:6.4.0" \
--max-scale 2 \
--tasks-from-local-file videos.jsonl \
--gpu l40s \
--cpu 20 \
--memory 100G \
--tasks-state-store fleet-task-store \
--mount-data-store /input=fleet-input-store:/videos \
--mount-data-store /output=fleet-output-store:/videos
```

## Conclusion

Upscaling videos using IBM Cloud Code Engine Serverless Fleets showcases the power and flexibility of modern serverless architectures for high-performance, GPU-accelerated workloads. By combining the simplicity of Code Engine with the scalability of Serverless Fleets and the efficiency of the Video2X framework, developers can process large volumes of media files in parallel — without the burden of managing infrastructure.
This hands-on example demonstrates how easy it is to orchestrate complex tasks like video upscaling in a secure, isolated environment using IBM Cloud Code Engine Serverless Fleets. From provisioning resources with a one-time setup script to defining tasks in a structured `videos.jsonl` file and executing them with fine-tuned compute configurations, the entire workflow is streamlined for productivity and performance.
Whether you're working on media processing, AI inference, or scientific workloads, IBM Cloud Code Engine Serverless Fleets provides a robust and developer-friendly solution. With support for GPU-enabled VSIs, customisable networking, and seamless integration with IBM Cloud Object Storage, you can build scalable, enterprise-grade pipelines with minimal operational overhead.
Ready to take it further? Dive into the Video2X GitHub repository to explore various models and fine-tune parameters to suit your needs. Start building your own Code Engine Serverless Fleet powered video processing workflows on IBM Cloud today.
While you're at it, be sure to also check out the other powerful components of Code Engine -- [Applications](https://cloud.ibm.com/docs/codeengine?topic=codeengine-application-workloads), [Jobs](https://cloud.ibm.com/docs/codeengine?topic=codeengine-job-plan), and [Functions](https://cloud.ibm.com/docs/codeengine?topic=codeengine-fun-work) -- as well as additional Serverless Fleets use cases like Batch Inferencing, Docling, and Monte Carlo Simulation available in the [sample repository](https://github.com/IBM/CodeEngine/).