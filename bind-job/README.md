# Bind-Job

This sample shows how to bind an instance of an IBM Cloud managed service
to a batch job. Under the covers this will query the service to get
information such as the credentials to talk to it, and its location URL.
Then it'll create a secret with that information and bind that secret to
your job. Meaning, it'll make the secret name/value pairs visible as a
set of environment variables.

In this sample we'll create an instance of a DB2 service.
