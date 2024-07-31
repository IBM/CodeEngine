# IBM MQ Observer

## Introduction
This sample demonstrates how you can create a message queue observer, that allows interested Code Engine applications and jobs to register their interest for IBM MQ queues on IBM MQ queue managers. The observer will send 'wake-up' notifications when messages are available on the queues.

## Overview of features
- The observer can be given a seed set of registrations on start-up should the messaging jobs already exist. This avoids the need to open ports and run unnecessary http server instances.
- The observer allows for dynamic registrations. i.e., I have an observer running, and a new messaging job that I want to register for notifications.
- Applications can revoke their registrations.
- The observer can monitor multiple queues on multiple queue managers.
- The observer can also be hosted in Code Engine, but can also run in an external runtime environment.
- Code Engine Applications can register http URL endpoints. 
- Code Engine Jobs can register as job names. 
- Registration data may be ephemeral, but support for a  persistenta persistent store is included. 
- Cycle times, e.g., the time duration between queue depth queries and the time duration between persisting data are customisable through environment variables, and configmaps. 
- The observer can be made to back-off for a duration sending notifications to applications and jobs that fail to start.
- The observer uses the MQ REST admin API to monitor queue depths.
- Application and job developers can choose how to process messages.
- A sample consumer is provided, that uses the IBM MQ C based MQI API.
- Both the observer and message consumer saamples are implemented in Go. 
- A ‘deploy script’ is provided that creates secrets, configmaps and deploys the observer and sample consumer as a Code Engine job definition. 
 
## IBMMQ Observer repository
You can find the IBM MQ Observer for Code Engine at in the [IBM Messaging Code Engine Observer repository](https://github.com/ibm-messaging/mq-code-engine-observer)

## IBMMQ Observer tutorial
A step by step guide is available as the tutorial [Write and trigger serverless MQ applications in IBM Cloud](https://developer.ibm.com/tutorials/mq-write-and-run-serverless-mq-applications/)
On IBM Developer.
