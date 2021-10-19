# ConfigMaps as Volumes

This sample shows how define and inject a configMap into an application as a
volume.  A ConfigMap is a set of key/value pairs.  The "key" of the configMap
will become the "name" of the file on disk and the corresponding
"value" in the configMap will be the contents of the file.

The application will log (print to stdout) all of the values from the
configMap.

Note: the same basic logic will work for Batch Jobs as well.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
