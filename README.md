[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/5760/badge)](https://bestpractices.coreinfrastructure.org/projects/5760)

# Tutorials and Samples for IBM Cloud Code Engine

This repository is split into two types of educational material: Tutorials
and Samples.

Tutorials are meant to be complete end-to-end scenarios designed
to teach you about [Code Engine](https://ibm.com/cloud/code-engine) as if you
have limited knowledge of Cloud Native technologies. Each provides a
step-by-step guide walking you through the process of deploying a certain
type of workload - explaining, in detail, each step in the process. The goal
is to not simply have you copy-n-paste each command but rather to understand
the "whys" of what's going on so you can apply what you've learned to one
of your own projects.

Samples are meant to be "quick-start" tasks that help developers
perform one very specific task. They do not include extra verbose help text
or explanations, rather they are designed for people who have a basic
understanding of Cloud Native technologies and want a quick reminder of how
to perform a certain task in the Code Engine environment. Most samples will
be relatively small so that it can be re-used easily and integrated into a
larger use-case.

### Getting Started

Code Engine requires that you use an IBM Cloud "paid account", even if you
don't plan on going beyond the
[free tier](https://www.ibm.com/cloud/code-engine/pricing).

#### Cloud Shell

The easiest way to run these are via the
[IBM Cloud Shell](https://cloud.ibm.com/shell) service. This is a browser based
command line that will have all of the IBM Cloud CLI components pre-installed
for you.

To ensure you have the latest versions of each CLI plugin, run:
```
$ ibmcloud plugin update --all --force
```
once you're in the shell.

#### Your Own Machine

If you choose to use your own machine, then the following need to be installed:
- [IBM Cloud command line (`ibmcloud`)](https://cloud.ibm.com/docs/cli/reference/ibmcloud?topic=cloud-cli-getting-started)
- [Code Engine plugin (`ce`)](https://cloud.ibm.com/codeengine/cli)
- [Cloud Object Storage plugin (`cos`)](https://cloud.ibm.com/docs/cloud-object-storage-cli-plugin)
- [Event Streams plugin (`es`)](https://cloud.ibm.com/docs/EventStreams?topic=EventStreams-cli#step5_es_cli)
  for samples which use IBM Event Streams (Kafka)
- [`docker`](https://docker.io/) if you choose to build the images yourself.
  For novices, skip this.

#### Let's go!

Once you have your environment ready, look at the README for the Tutorial
or Sample of interest to know if you'll need to clone this git repository
first. Most of the Samples will require it since it involves executing their
`run` script. The tutorials will try to avoid this requirement.

If you need, or want, to clone this repo simple execute:
```
$ git clone https://github.com/IBM/CodeEngine
```
and then `cd` into the `CodeEngine` directory.

If you have not already specified your IBM Cloud resource group, then
see the:
```
$ ibmcloud resource groups
$ ibmcloud target --help
```
commands for more information. Often it is called `default` or `Default`.

Most of the material in here assumes you aleady have a Code Engine
[project](https://cloud.ibm.com/docs/codeengine#term-summary) already created.
If you do not, go ahead and create one like this:

```
$ ibmcloud ce project create --name demos
```

With that, `cd` into the directory of interest, and read the README to see how
to get started.

## Tutorials / Assets

- [Gallery](gallery)<br>
  Walks through the complete growth path of a solution from the prototype
  stage through to production - showcasing how to the various components, 
  like applications, functions and jobs can be work together to implement a solution.

- [Docling](serverless-fleets/tutorials/docling)<br>
  This tutorial provides a comprehensive guide on using [Docling](https://docling-project.github.io/docling/) to convert PDFs into Markdown format using serverless fleets. It leverages cloud object storage for managing both the input PDFs and the resulting Markdown files. The process is streamlined using IBM’s Code Engine to build the Docling container, which is then pushed to a container registry. Users can run a serverless fleet, which autonomously spawns workers to run the Docling container for efficient, scalable conversion tasks.

- [Batch inferencing](serverless-fleets/tutorials/inferencing)<br>
  This tutorial provides a comprehensive guide on using Serverless GPUs to perform batch inferencing which illustrates a generally applicable pattern where AI helps to extract information out of a set of unstructed data. 

- [Metrics Collector](metrics-collector)<br>
  Re-usable asset that helps to gain insights on the CPU and memory consumption of apps, jobs and builds.

- [Fotobox](fotobox)
  Deploy your own Fotobox straight to the IBM Cloud access it directly from any device with browser and camera. Take pictures and view them all from your device.


## Samples

The samples are grouped by the main category of functionality that it
is demonstrating.

#### Apps
- [helloworld](helloworld)<br>
  Very basic "hello world!" type of application writtin in golang. Start here!
- [auth-oidc-proxy](auth-oidc-proxy)<br>
  This sample demonstrates how to configure an authentication/authorization layer that fronts any arbitrary Code Engine application. In principal, this pattern is pretty generic. To demonstrate it, we chose to implement it with OpenID Connect (OIDC), an authentication framework that is built on top of the OAuth 2.0 protocol.

#### Fleets
- [serverless-fleets](serverless-fleets)<br>
  To learn how to simplify and optimize large-scale parallel computation with Serverless Fleets, you should start here!

#### Batch Jobs
- [helloworld](helloworld)<br>
  This is another simple Batch Job sample, similar to the previous one, but
  shows how to use environment variables to modify the behavior of the runtime
  of the job.
- [Trusted Profiles](trusted-profiles)<br>
  In the IBM Cloud, when authenticating with other services such as Cloud
  Object Storage or Secrets Manager, using trusted profiles is a way to
  authenticate without any API keys being used. This eliminates the risk of
  those being leaked or stolen by a malicious user who uses them to access your
  IBM Cloud resources.
- [cronjob](cronjob)<br>
  This will create a Batch Job that will be invoked based on a cron
  event. Meaning, it'll be executed based on a timer.

#### Function

- [function-inline-nodejs](helloworld-samples/function-inline-nodejs)<br>
  This example shows how to create simple inline Node.js function
- [function-inline-python](helloworld-samples/function-inline-python)<br>
  This example shows how to create simple inline Python function
- [function-codebundle-nodejs](helloworld-samples/function-codebundle-nodejs)<br>
  This example shows how to create Node.js functions with additional modules
- [function-typescript-codebundle-nodejs](helloworld-samples/function-typescript-codebundle-nodejs)<br>
  This example shows how to create TypeScript functions with additional modules
- [function-codebundle-python](helloworld-samples/function-codebundle-python)<br>
  This example shows how to create Python functions with additional modules
- [function-http-nodejs](helloworld-samples/function-http-nodejs)<br>
  This example shows how to create Node.js functions with can perfome a http request without additional modules
- [function-http-python](helloworld-samples/function-http-python)<br>
  This example shows how to create Python functions which can perfome a http request without additional modules
- [function-python-go-binary](helloworld-samples/function-python-go-binary/README.md)<br>
  This example shows how to create a Python function which includes and executes a Go binary

#### Eventing
- [cron](cron)<br>
  This will show how to setup a simple Cron Event Source and send
  its events to an Application.
- [cronjob](cronjob)<br>
  This will create a Batch Job that will be invoked based on a cron
  event. Meaning, it'll be executed based on a timer.
- [cos-event](cos-event)<br>
  This will show how to setup a COS Event Source and send its events to
  an Application.
- [github](github)<br>
  This sample will show how to get events from Github (via its webhooks)
  delivered to a Code Engine Application.
- [kafka-observer](kafka)<br>
  This provides a sample implementation of the observer pattern, 
  which is a native approach to consume Kafka messages in IBM Cloud Code Engine.
  

## Layout of the repository

These are designed such that they should be able to be fully built
and used by anyone. Unless otherwise noted the overall pattern that will be
followed is:

- a `build` script shows how each container image used in the sample is built.
  By default, the script will push the image to the `icr.io/codeengine`
  namespace, so to use this yourself you'll need to set the `REGISTRY`
  environment variable to your own registry and/or namespace. Also, you
  MUST use a registry that allows for anonymous/public downloads of your
  images, since as of now (to keep the scripts simple) they do not deal
  with private registry access tokens by default.
  - However, if you do decide to push your images into a registry that
    is private, you'll need to modify the `run` scripts to specify the
	`--registry-secret` option on the app and job creation commands to point
	to your secret that includes the registry credentials.
- a `run` script will execute the sample. Most will also include logic to
  verify the output to ensure everything is working as expected. As with
  `build`, it will default to using the `icr.io/codeengine` container images,
  so to use your own you'll need to set the `REGISTRY` environment variable.
  This means that you should be able to just execute `run` without running
  `build` first, and it'll just use the pre-built images from
  `icr.io/codeengine`.
  - invoking `run clean` should clean up from any previous execution without
    re-running the sample.

## Additional Resources

- [IBM Cloud Code Engine](https://www.ibm.com/products/code-engine)
- For questions/comments join us on Slack:<br>
  [Register](https://cloud.ibm.com/kubernetes/slack) |
  [Login](https://ibm-cloud-success.slack.com/) and join us on the
  [#code-engine](https://ibm-cloud-success.slack.com/archives/C014051FRCG)
  channel

You may also open [issues](https://github.com/IBM/CodeEngine/issues) and
[PRs](https://github.com/IBM/CodeEngine/pulls) in the repository too.
