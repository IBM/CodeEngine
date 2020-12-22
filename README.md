# Samples for IBM Cloud Code Engine

This repository contains samples for how to use
[IBM Cloud Code Engine](https://cloud.ibm.com/codeengine).

These samples are designed such that they should be able to be fully built
and used by anyone. Unless otherwise noted the overall pattern that will be
followed is:

- a `build` script shows how each container image used in the sample is built.
  By default, the script will push the image to the `ibmcom` namespace on
  DockerHub, so to use this yourself you'll need to set the `REGISTRY`
  environment variable to your own registry and/or namespace. Also, you
  MUST use a registry that allows for anonymous/public downloads of your
  images, since as of now (to keep the scripts simple) they do not deal
  with private registry access tokens by default.
- a `run` script will execute the sample. Most will also include logic to
  verify the output to ensure everything is working as expected. As with
  `build`, it will default to using the `ibmcom` container images, so to use
  your own you'll need to set the `REGISTRY` environment variable.
  This means that you should be able to just execute `run` without running
  `build` first, and it'll just use the pre-built images from `ibmcom`.
  - invoking `run clean` should clean up from any previous execution without
    re-running the sample.

Most samples will try to be relatively small to focus on one particular
task so that it can be re-used easily and integrated into a larger use-case.

It is assumed that the following are installed:
- [IBM Cloud command line (`ibmcloud`)](https://cloud.ibm.com/docs/cli/reference/ibmcloud?topic=cloud-cli-getting-started)
- [Code Engine plugin (`ce`)](https://cloud.ibm.com/codeengine/cli)
- [Cloud Object Storage plugin (`cos`)](https://cloud.ibm.com/docs/cloud-object-storage-cli-plugin)
  for samples which use IBM Cloud Object Storage
- [`kubectl`](https://kubernetes.io/docs/tasks/tools/install-kubectl/) for
  the rare sample that might need to dive really deep behind the scenes
- [`docker`](https://docker.io/) if you choose to build the images yourself

It is also assumed that you have a Code Engine project already created and
selected, e.g.:
```
$ ibmcloud ce project create --name demos --select
```

## Samples

#### Apps
- [hello](hello)<br>
  Very basic "hello world!" type of application written in Node.js. Start here!
- [helloworld](helloworld)<br>
  Similar to [hello](hello) except this is written in golang and adds a few
  bells-n-whistles to allow you to control what it does when invoked.
- [bind-app](bind-app)<br>
  This will create an instance of DB2 in the IBM Cloud and then ask Code
  Engine to bind it to an Application so we can access it from the App. The
  credentials, etc. will be injected into the App via environment variables.
- [cecli](cecli)<br>
  Show how to invoke the Code Engine CLI from within an App. This can be used
  to then start additional Code Engine resources (Apps/Jobs) dynamically.
  Same logic could be used in Batch Jobs.

#### Batch Jobs
- [job](job)<br>
  This will create a Batch Job that will print basic debugging information to
  the logs, and then show those logs. It'll create the Batch Job with and
  without a Job definition to show both options.
- [app-n-job](app-n-job)<br>
  This will use the same image for both an Application and a Batch Job.
  Just to show that it's possible.
- [app2job](app2job)<br>
  This will show how to submit a Job from an Application based on an incoming
  HTTP request to the Application.
- [bind-job](bind-job)<br>
  This will create an instance of DB2 in the IBM Cloud and then ask Code
  Engine to bind it to a Batch Job so we can access it from the Job. The
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
- [ping](ping)<br>
  This will show how to setup a simple Ping(cron) Event Source and send
  its events to an Application.
- [cos-event](cos-event)<br>
  This will show how to setup a COS Event Source and send its events to
  an Application.

#### Misc
- [configmaps](configmaps)<br>
  Shows how to define and inject a ConfigMap as environment variables
  into an Application.
- [secrets](secrets)<br>
  Shows how to define and inject a Secret as environment variables
  into an Application.
- [sessions](sessions)<br>
  Starts a stateful application that scales based on load. The state is kept
  in an instance of Redis, also running within Code Engine. Demonstrates the
  use of non-http components and private networking between components.

## Resources

- [IBM Cloud Code Engine](https://cloud.ibm.com/codeengine)
- For questions/comments join us on Slack:<br>
  [Register](https://cloud.ibm.com/kubernetes/slack) |
  [Login](https://ibm-cloud-success.slack.com/) and join us on the
  [#code-engine](https://ibm-cloud-success.slack.com/archives/C014051FRCG)
  channel

You may also open [issues](https://github.com/IBM/CodeEngine/issues) and
[PRs](https://github.com/IBM/CodeEngine/pulls) in the repository too.
