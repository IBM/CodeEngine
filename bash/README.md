# BASH

This sample will show how to create an application that is nothing more than
a bash script. While there is still an HTTP server as part of the solution,
you should be able to reuse the `bash` container image in other projects
without needing to do more than just provide a custom bash script.

In this setup the follow will happen:
- during the startup of each instance of your applciation, if present,
  a file named `/app/init` will be invoked. You can also set an environment
  variable called `INIT` to the path of an additional program that you
  want executed. The environment variable program will be called after
  `/app/init`. This allows for you to execute code that you want only
  run once per instance - and not on each incoming HTTP request.
- upon receiving an HTTP request, a file named `/app/app` will be invoked.
  The following environment variables will be set:
  - `METHOD` - the HTTP method (GET, POST,...) values
  - `URL` - the URL from the HTTP request
  - `HEADER_xxx` - where `xxx` is an HTTP header name, and the environment
    variable's value is the HTTP headers value. All HTTP headers will appear
	as environment variables.
- if `/app/app` exits with a zero exit code then an HTTP `200 OK` will be
  returned. Otherwise an HTTP `503 Internal Server Error` will be returned.
- if you define an environment variable called `DEBUG` then the application
  will print useful debugging information in the logs

The `/app/init` program in this sample will log into the IBM Cloud using
an API Key provided in a secret. The `/app/app` program will invoke the
`ibmcloud ce app list` command and return the result to the client.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
