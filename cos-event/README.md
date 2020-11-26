# Cloud Object Storage

This sample shows how to create an IBM Cloud Object Storage (COS) Event Source and hook it up
to an Application that will receive its events. An event is sent for each successful change to
an object in the COS bucket.

The `run` script will create the app and an event subscription connecting the app to the specified
COS bucket.  The script will then upload a file to the bucket, resulting in the generation of an event.
On receipt of the event, the app will log the event to stdout and increment a set of internal
counters.  The script queries the app on the `/stats` endpoint and displays these updated counters.

If you already have a COS instance that you want to use, you can set the `COS_ID`
environment variable to the CRN of that instance.  You can find existing instances
by running
```
ibmcloud resource service-instances --service-name cloud-object-storage --long
```
If you want to use one of the listed instances, set `COS_ID` to the instance CRN/ID
 (the value in the first column of each row).  If you leave this variable unset,
the `run` script will attempt to create a `lite` (free of charge) COS instance
for you, which it will then delete upon completion.  It will not delete any existing
instance you specify via the `COS_ID` variable.
