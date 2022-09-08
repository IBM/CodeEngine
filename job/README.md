# Job

This sample shows up to run a batch job. It will create the batch job two ways:
1 - first, it'll create a Job definition (the config information about a job)
    and then it submits that Job to actually do the work.
2 - second, it'll submit the Job directly without creating the definition
    first. Both will generate the same results though.

Each instance of each Job submitted will print, to its logs, its "index",
which is defined by its `JOB_INDEX` environment variable. The `run` script
will print some of the log files to show this.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
