# HelloWorld

A pretty simple golang application / job that, in its most basic form, will
return "Hello World" back to the caller.

If environment variable `JOB_INDEX` is set, the binary will act as run-to-completion
workload - it prints text to stdout and completes with exit code 0. So when using
the image in a Code Engine Batch job, it will act accordingly.

When using the image in a Code Engine Application, it will listen to requests and
respond to them. It will keep running until stopped from outside.

Check the source code for all of the things you can make it do either via
environment variables or query parameters. This is good for testing the
system to see how it reacts - for example, when the app crashes.