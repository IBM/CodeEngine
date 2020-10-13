# App2Job

This sample will show how to create a Batch Job from within an Application.
It will first create an Application and then a Job definition. The Job will
simply print a welcome message to its logs. The Job will be defined to run
50 instances.

The Application will wait for an HTTP PUT request containing the name of the
Job definition in its HTTP Path. It will then use that Job definition name
to submit a new Job. When the job is done, it will then check the logs of the
Job to verify it worked correctly.
