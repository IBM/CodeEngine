# Authentication Proxy

This sample will show how to setup an application using `nginx` that acts
as proxy, and authentication checker, for a secondary application. The
secondary application is not exposed to the internet (it is "cluster local"),
to ensure that only authorized users can access it.

The nginx authentication checks are done by checking the username and password
values that are stored in the `htpasswd` file.

There is a bit of a trick here in that we need to modify our nginx config
file to include the Code Engine subdomain name (ie. kubernetes namespace)
as part of the proxy configuration. To do that, we'll wrapper the call to
`nginx` at runtime with a bash script that will replace all `NS` strings
in the nginx config file with the subdomain value we pick up from the
`CE_SUBDOMAIN` environment variable.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.

