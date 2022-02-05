# Tutorials and Samples for IBM Cloud Code Engine

This respository is split into two types of educational material: Tutorials
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
$ ibmcloud resource group
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

## Tutorials

- [Thumbnail Generator](thumbnail)<br>
  Walks through the complete growth path of an application from the prototype
  stage through to production - demonstrating how to switch from an in-app
  processor to one where the data is persisted and processed via an
  event-driven architecture.

## Samples

The samples are grouped by the main category of functionality that it
is demonstrating.

#### Apps
- [hello](hello)<br>
  Very basic "hello world!" type of application written in Node.js. Start here!
- [helloworld](helloworld)<br>
  Similar to [hello](hello) except this is written in golang and adds a few
  bells-n-whistles to allow you to control what it does when invoked.
- [auth](auth)<br>
  This shows how to setup an nginx proxy in-front of a private application
  to ensure that only authorized people can access it.
- [bash](bash)<br>
  This shows how you can create an application from a bash script without
  the need to write your own HTTP server.
- [bind-app](bind-app)<br>
  This will create an instance of Event Streams in the IBM Cloud and then ask
  Code Engine to bind it to an Application so we can access it from the App.
  The credentials, etc. will be injected into the App via environment variables.
- [cecli](cecli)<br>
  Show how to invoke the Code Engine CLI from within an App. This can be used
  to then start additional Code Engine resources (Apps/Jobs) dynamically.
  Same logic could be used in Batch Jobs.
- [private](private)<br>
  Show how to create a "private" application that is only accessible from
  within the project (no external/internet access).
- [sessions](sessions)<br>
  Starts a stateful application that scales based on load. The state is kept
  in an instance of Redis, also running within Code Engine. Demonstrates the
  use of non-http components and private networking between components.
- [websocket](websocket)<nr>
  Shows how to interact with an Application via WebSockets.

#### Batch Jobs
- [job](job)<br>
  This will create a Batch Job that will print basic debugging information to
  the logs, and then show those logs. It'll create the Batch Job with and
  without a Job definition to show both options.
- [testjob](testjob)<br>
  This is another simple Batch Job sample, similar to the previous one, but
  shows how to use environment variables to modify the behavior of the runtime
  of the job.
- [cronjob](cronjob)<br>
  This will create a Batch Job that will be invoked based on a cron
  event. Meaning, it'll be executed based on a timer.
- [app-n-job](app-n-job)<br>
  This will use the same image for both an Application and a Batch Job.
  Just to show that it's possible.
- [app2job](app2job)<br>
  This will show how to submit a Job from an Application based on an incoming
  HTTP request to the Application.
- [bind-job](bind-job)<br>
  This will create an instance of Event Streams in the IBM Cloud and then ask
  Code Engine to bind it to a Batch Job so we can access it from the Job. The
  credentials, etc. will be injected into the Job via environment variables.
- [job2app](job2app)<br>
  This will demostrate how to create a simple Batch Job and how to have it
  communicate with an Application running within the same project.

#### Source-to-Image
- [s2i-buildpacks](s2i-buildpacks)<br>
  This will show how to use the source-to-image feature of Code Engine to
  build an Application from a git repo (using a Buildpack), push it to a
  private registry, and then deploy an Application using that image.
- [s2i-dockerfile](s2i-dockerfile)<br>
  This will show how to use the source-to-image feature of Code Engine to
  build an Application from a git repo (using a Dockerfile), push it to a
  private registry, and then deploy an app using that image.

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
- [cos2cos](cos2cos)<br>
  This will show how you can use eventing to monitor changes in a Cloud
  Object Storage bucket, and then act on those changes by processing any
  new files in the bucket and then uploading a new object into a secondary
  bucket. It can also get Cron events to periodically check for missed
  files.
- [github](github)<br>
  This sample will show how to get events from Github (via its webhooks)
  delivered to a Code Engine Application.
- [kafka](kafka)<br>
  This sample shows how to create a Kafka subscription to automatically have
  messages in a Kafka instances delivered to an application.

#### Misc
- [configmaps-env](configmaps-env)<br>
  Shows how to define and inject a ConfigMap as environment variables
  into an Application.
- [configmaps-vol](configmaps-vol)<br>
  Shows how to define and inject a ConfigMap as a volume into an Application.
- [secrets-env](secrets-env)<br>
  Shows how to define and inject a Secret as environment variables
  into an Application.
- [secrets-vol](secrets-vol)<br>
  Shows how to define and inject a Secret as a volume into an Application.

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

- [IBM Cloud Code Engine](https://ibm.com/cloud/code-engine)
- For questions/comments join us on Slack:<br>
  [Register](https://cloud.ibm.com/kubernetes/slack) |
  [Login](https://ibm-cloud-success.slack.com/) and join us on the
  [#code-engine](https://ibm-cloud-success.slack.com/archives/C014051FRCG)
  channel

You may also open [issues](https://github.com/IBM/CodeEngine/issues) and
[PRs](https://github.com/IBM/CodeEngine/pulls) in the repository too.
