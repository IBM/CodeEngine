# Function2Job

This sample will show how to submit a batch job from within an Function.

It uses the Code Engine API to submit a job run and passes on the received URL query param `greeting` that has been passed to the function.

In order to authenticate properly, it requires to set an environment variable `IBMCLOUD_API_KEY` containing an API key that has Writer access to the Code Engine project that has been selected via the CLI currently.