# IBM MQ Observer

## Introduction
This sample demonstrates how IBM Cloud Code Engine serverless jobs and applications can be scaled in relation to the depth of IBM MQ queues. The sample is based on an observer pattern that periodically inspects the depth of queue manager hosted queues that Code Engine applications have registered an interest for.

## Overview of features
- The observer sample uses the IBM MQ REST admin API to monitor queue depths.
- The observer sample can be configured to monitor multiple queues across multiple queue managers.
- The observer sample may be hosted on Code Engine or within an external runtime environment.
- The observer sample can be pre-loaded with static list of queue manager : queue pair registrations on start-up.
- The observer sample supports 'dynamic registrations' where Code Engine jobs and applications register for queue depth notifications at runtime.
- Applications can dynamically revoke their registrations at runtime.
- Code Engine Applications can register as http URL endpoints or Code Engine job names.
- By default registration data is ephemeral (held in memory), but the sample can be optionally configured to use a persistent store.
- The time duration between validating registrations and checking queue depths i.e., Cycle Times, is customisable through environment variables, and configmaps.
- The observer sample includes a back-off feature to reduce overhead where Code Engine applications and jobs persistently fail to start.
- The observer sample provides notification only, leaving application and job developers to determine how to consume and process messages.
- A message consumer sample is provided, that showcases using the IBM MQ API to process messages.
- The observer and message consumer samples are implemented in Go.
- A ‘deploy script’ is provided to simplify the creation of secrets, configmaps and deployment of  the observer and sample consumer as a Code Engine job definition.

## IBMMQ Observer repository
You can find the IBM MQ Observer for Code Engine at in the [IBM Messaging Code Engine Observer repository](https://github.com/ibm-messaging/mq-code-engine-observer)

## IBMMQ Observer tutorial
A step by step guide is available as the tutorial [Write and trigger serverless MQ applications in IBM Cloud](https://developer.ibm.com/tutorials/mq-write-and-run-serverless-mq-applications/)
On IBM Developer.
