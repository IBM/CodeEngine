# App-n-Job

This will build an image that can be used for both Applications and Batch Jobs.
By checking for the presence of the `JOB_INDEX` environment variable, the code
will know whether to start a web service (Application) or just do its task
and exit (Batch Job).
