# ConfigMaps

This sample shows how define and inject a configMap into an application as a
set of environment variables. A ConfigMap is a set of key/value pairs.
The "key" of the configMap will become the "name" of the environment variable
and the corresponding "value" in the configMap will be the "value" of that
environment variable.

The application will log (print to stdout) all of its environment variables.

Note: the same basic logic will work for Batch Jobs as well.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image used
- a `run` script which deploys a new Application using that image

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
