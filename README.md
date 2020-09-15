# Samples for IBM Cloud Code Engine

This repository contains samples for how to use
[IBM Cloud Code Engine](https://cloud.ibm.com/codeengine).

These samples are designed such that they should be able to be fully built
and used by anyone. Unless otherwise noted the overall pattern that will be
followed is:

- a `build` script shows how each container image used in the sample is built.
  By default, the script will push the image to the `ibmcom` namespace on
  DockerHub, so to use this yourself you'll need to set the `REPOSITORY`
  environment variable to your own registry and/or namespace.
- a `run` script will execute the sample. Most will also include logic to
  verify the output to ensure everything is working as expected. As with
  `build`, it will default to using the `ibmcom` container images, so to use
  your own you'll need to set the `REPOSITORY` environment variable.
  This means that you should be able to just execute `run` without running
  `build` first, and it'll just use the pre-built images from `ibmcom`.

Most samples will try to be relatively small to focus on one particular
task so that it can be re-used easily and integrated into a larger use-case.

It is assumed that the following are installed:
- [IBM Cloud command line (`ibmcloud`)](https://cloud.ibm.com/docs/cli/reference/ibmcloud?topic=cloud-cli-getting-started)
- [Code Engine plugin (`ce`)](https://cloud.ibm.com/codeengine/cli)
- [`kubectl`](https://kubernetes.io/docs/tasks/tools/install-kubectl/) for
- [`docker`](https://docker.io/) if you choose to build the images yourself

It is also assumed that you have a Code Engine project already created, e.g.:
```
$ ic ce project create --name demos --target
```

### Samples

- [hello](hello)<br>
  Very basic "hello world!" type of application written in Node.js. Start here!
- [helloworld](helloworld)<br>
  Similar to [hello](hello) except this is written in golang and adds a few
  bells-n-whistles to allow you to control what it does when invoked.
- [job](job)<br>
  This will demostrate how to create a simple Batch Job and how to have it
  communicate with an Application running within the same project.
- [sessions](sessions)<br>
  Starts a stateful application that scales based on load. The state is kept
  in an instance of Redis, also running within Code Engine. Demonstrates the
  use of non-http components and private networking between components.

### Resources

- [IBM Cloud Code Engine](https://cloud.ibm.com/codeengine)
- For questions/comments join us on Slack:<br>
  [Register](https://cloud.ibm.com/kubernetes/slack) |
  [Login](https://ibm-cloud-success.slack.com/) and join us on the
  [#code-engine](https://ibm-cloud-success.slack.com/archives/C014051FRCG)
  channel

You may also open [issues](https://github.com/IBM/CodeEngine/issues) and
[PRs](https://github.com/IBM/CodeEngine/pulls) in the repository too.
