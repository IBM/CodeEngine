# Secrets as Volumes

This sample shows how create and inject a secret into an application as a
volume. A Secret is a set of key/value pairs, similar to ConfigMaps, except
secret data is protected/encrypted at rest. Which makes them a great choice
for private data such as credentials or passwords.

The "key" of the secret will become the "name" of the environment variable and
the corresponding "value" in the secret will be the "value" of that
environment variable.

The application will log (print to stdout) all of its environment variables.

Note: the same basic logic will work for Batch Jobs as well.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
