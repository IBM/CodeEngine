# COS-to-COS

This sample shows a somewhat more complex example than some of the others - it
demonstrates a simple event-driven application pattern wherein the uploading of
an object to a Cloud Object Storage (COS) bucket generates an event.  When the
app receives the event, it parses out the bucket and object key from the event,
downloads the object (file), "processes" it, and then uploads the resulting
file to a separate (preconfigured) destination bucket.  The app then deletes
the file from the original source bucket.

The app also includes a listener for cron events.  Upon receipt of a cron event,
it will inventory the source bucket for files.  Any file found is assumed not to
have been processed successfully, so the app then
processes the file as per normal (including deleting it from the source bucket).

This app also includes some informational endpoints which can be used to inspect
what it is doing/has done:

- `/events/stats`: A GET request against this endpoint returns statistics about events
in JSON.  This includes counters of COS events processed successfully, COS events
which resulted in errors (of any type, for any reason), cron events processed
successfully, and cron events which resulted in errors.
- `/events/history`: This displays an HTML page showing a list of all events
received since the application started.  The list includes, for each event,
information such as the event type, time of receipt, and a list of files
processed as a result of the event, as well as a status and timestamp for the
processing of each file.
- `/files`: This displays a table showing each file known to the app and its
presence (or lack thereof) in each bucket.

All of this information is maintained in memory, so the `run` script creates the
app with minimum and maximum scale values of 1.  This ensures that there is always
exactly one instance of the app running, regardless of load.  In a real application,
you would want to externalize the storage of statistics and history information,
using e.g. a redis instance, which would then let you share the information across
instances and allow you to take advantage of Code Engine's scale-to-zero
capabilities.

The app is written/packaged as a [Flask](https://flask.palletsprojects.com/en/1.1.x/)
application and deployed using the built-in development server (which is not
  meant for general production usage).

## How to use the sample

The `run` script will create the app and an event subscription connecting the
app to the specified COS bucket. The script will then upload a file to the
bucket, resulting in the generation of an event.  Upon receiving the event,
the application will take the names of the bucket and object listed in the event,
retrieve the object, process it, and then upload the result to a different bucket.
The application then deletes the object from the original source bucket.

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

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
