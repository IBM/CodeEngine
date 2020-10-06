# Ping

This sample shows how to create a Ping (cron) Event Source and hook it up
to an Application that will receive its events. An event is sent once a
minute and will contain just a simple JSON object as the payload.

The App will log (print to stdout) each event as it arrives, showing the
full set of HTTP Headers and HTTP Body payload. This makes it a useful
tool for testing other Event Sources, to see what they generate.
