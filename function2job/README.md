# Function2Job

This sample will show how to submit a batch job from within an Function.

It will first create an Function and then a Job. The Job will simply
print a welcome message to its logs. The Job will be defined to run 1 instance.
The Function will be triggered through a HTTP GET request. It will then use the Code Engine API 
to submit a job run and passes on the received URL query param `greeting` that has been passed to the function. 
To verify that it worked correctly, the script will check 
the job run logs for the greeting text that has been passed to the Function. 

In order to use to authenticate towards the Code Engine API properly, 
the function expects an IAM API key as an environment variable `CE_API_KEY`. 
The API key must have at least `Writer` access to the Code Engine project.
As part of this sample an IAM serviceID, policies and an APIKey wilk be created an shared
with the Code Engine project. 

**Note:** The script expects the user to have a Code Engine project selected.
```
$ ibmcloud ce project select --name <your-project-name>
```

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
