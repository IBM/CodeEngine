# Test Job

This sample shows how to run a batch job as a daemon. This example is  similar to the
[testjob](../testjob) sample, but this job does not stop running until stopped (or the end of time). It can be customized by using the following environment variables:
  - `MSG`: Specifies the message that is printed to the logs. By default, this message is a simple "Hello World".
  - `TARGET`: Change the word "World" to something else when the default message is printed. For example, "TARGET=Friend" prints "Hello Friend" as the message.
  - `SLEEP`: Tells the code to sleep for the specified number of seconds
    before exiting.

The code also prints the list of environment variables to the log file
for debugging purposes.

The sample script submits the job twice. First by creating a
job definition, followed by submitting it, and then it submits a new
job directly without first creating a job definition. In the second case,
it also changes the message printed with the `MSG` environment variable.
- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script that builds the container image(s) used
- a `run` script that deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
