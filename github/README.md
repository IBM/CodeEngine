# Github

This sample will show how to get events from Github (via its webhooks)
delivered to a Code Engine Application. In this case the Application will
look for a "push" even and then pretend to kick off a new build for that
repository. While the code in here doesn't do the build itself, to keep it
simple, if you combine this sample with the "cecli" sample you should be
able to do a full build pipeline.

In this sample we simulate the event from github via a "curl" command
sending the "sample-commit" file as the event. In a real scenario you'll
want to setup your github repo to send "push" events to your Code Engine
application. You can do that by:
- going to your repo's "setting"
- click on "Webhooks"
- press "Add webhook" button
- in the "Payload URL" field put the URL to your Code Engine application
- in the "Content type" drop-down, select "application/json"
- In the "Secret" field entry some random string. This will be used to
  verify that the event it coming from your repo
- leave "Just the push event." radio button selected
- press "Add webhook"

You should immediately see a "ping" event sent to your application as a
test.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
