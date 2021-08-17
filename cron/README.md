# Cron (aka. Ping)

This sample shows how to create a Cron Event Source and hook it up
to an Application that will receive its events. An event is sent once a
minute and will contain just a simple JSON object as the payload.

The App will log (print to stdout) each event as it arrives, showing the
full set of HTTP Headers and HTTP Body payload. This makes it a useful
tool for testing other Event Sources, to see what they generate.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
