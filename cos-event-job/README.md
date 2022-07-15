# Cloud Object Storage

This sample shows how to create an IBM Cloud Object Storage (COS) Event Source
and hook it up to a Batch Job that will receive its events. An event is
sent for each successful change to an object in the COS bucket.

The `run` script will create the job and an event subscription connecting the
job to the specified COS bucket. The script will then upload a file to the
bucket, resulting in the generation of an event. On receipt of the event, the
a jobrun will be created based on the job.
The job simply shows the CE_DATA environment variable which contains the information on the event on which the jobrun got triggered.

If you already have a COS instance that you want to use, you can set the
`COS_ID` environment variable to the CRN of that instance. You can find
existing instances by running
```
ibmcloud resource service-instances --service-name cloud-object-storage --long
```
If you want to use one of the listed instances, set `COS_ID` to the instance
CRN/ID (the value in the first column of each row). If you leave this
variable unset, the `run` script will attempt to create a `lite` (free of
charge) COS instance for you, which it will then delete upon completion. It
will not delete any existing instance you specify via the `COS_ID` variable.

