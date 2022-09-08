# Kafka

This sample shows how to create a Kafka subscription to automatically have
messages in a Kafka instances delivered to an application.

The first part of this sample will create an instance of IBM Cloud Event
Streams (kafka), then create a topic (topic1) to hold our messages. It
will then download the credentials (and broker URLs) so that we can use
that to setup our subscription and Kafka "sender" application that will
add messages to our Kafka instance.

The second part of the sample will create a Kafka subscription and send
all incoming messages to a new application called "receiver". In order
to setup the Kafka subscription we'll first need to store the credentials
(`username` and `password`) in a secret, then pass in that secret name on
the subscription "create" command. We'll also need to pass in the list of
Broker URLs (from the first section) and the list of topics we want to
pull from.

The messages will be sent to our application a HTTP POST requests, just
like any other event subscription.

It will then run the `sender` application to load messages into Kafka via
a `curl` command. And finally, check the `receiver` application's logs
for the messages to arrive.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
