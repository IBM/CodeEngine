# App2Job

This sample will show how to create a Batch Job from within an Application.
It will first create an Application and then a Job definition. The Job will
simply print a welcome message to its logs. The Job will be defined to run
50 instances.

The Application will wait for an HTTP PUT request containing the name of the
Job definition in its HTTP Path. It will then use that Job definition name
to submit a new Job. When the job is done, it will then check the logs of the
Job to verify it worked correctly.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
