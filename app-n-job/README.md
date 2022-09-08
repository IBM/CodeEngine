# App-n-Job

This will build an image that can be used for both Applications and Batch Jobs.
By checking for the presence of the `JOB_INDEX` environment variable, the code
will know whether to start a web service (Application) or just do its task
and exit (Batch Job).

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
