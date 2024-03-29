# Bind-App

This sample shows how to bind an instance of an IBM Cloud managed service
to an Application. Under the covers this will query the service to get
information such as the credentials to talk to it, and its location URL.
Then it'll create a secret with that information and bind that secret to
your App. Meaning, it'll make the secret name/value pairs visible as a
set of environment variables. But as the App owner you only need to look at
the new environment variables that will be added to the App.

In this sample we'll create an instance of an Event Streams service.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
