# CronJob

This sample shows how to create a Cron Event Source and hook it up
to a Batch Job. The typical scenario here is that you want to run a certain
task periodically - usually at a certain time during the day. For example,
perhaps to do something each day at midnight.

The Job will log (print to stdout) the event just to prove that it was
invoked. Whether a real Job actually uses the event itself, or ignores it,
is up to the developer of the Job.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
