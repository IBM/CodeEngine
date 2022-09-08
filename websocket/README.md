# WebSockets

This sample will show how to use WebSockets to talk to a Code Engine
Application.  The sample itself is fairly straight forward. It starts a server
that will upgrade any incoming HTTP request into a WebSocket connection. The
client initiates a request (which, under the covers, converts the
HTTP request into a WebSocket). The client will then send a series of
messages (strings) and in parallel reads messages from the server. The
server will simply reverse the characters in the strings to generate the
response.

Since the client side of this sample required more than using the Code Engine
CLI and bash, it needs a real executable, and we couldn't be sure which
operating system the client is running on, this will run the client portion of
the sample in a Batch Job.

So, while on the one hand it makes the sample a bit more complex, on the other
hand it shows how you can use a Code Engine Batch Job to run a one-off
command without needing to install any of the command's prerequisites
locally on your machine.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
