# CECLI

This sample will show how to use the IBM Cloud CLI (and in particular the
Code Engine CLI plugin) from within an Application.

This will first generate an API Key to access the Cloud, store that key
into a Secret and then the Application will use that key to log into the
Cloud and invoke the "ibmcloud ce app list" command each time an HTTP
request is received.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
