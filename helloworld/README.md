# HelloWorld

A pretty simple golang application that, in its most basic form, will
return "Hello World" back to the caller.

Check the source code for all of the things you can make it do either via
environment variables or query parameters. This is good for testing the
system to see how it reacts - for example, when the app crashes.

Note: we added some extra logic to this so I can also be used as a batch job
but you can ignore that if all you care about is the App side of things.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
