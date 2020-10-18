# ConfigMaps

This sample shows how define and inject a configMap into an application as a
set of environment variables. A ConfigMap is a set of key/value pairs.
The "key" of the configMap will become the "name" of the environment variable
and the corresponding "value" in the configMap will be the "value" of that
environment variable.

The application will log (print to stdout) all of its environment variables.
