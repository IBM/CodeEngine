# Kafka Observer

## Introduction

This sample demonstrates how you can use IBM Cloud Code Engine and IBM Cloud Event Streams to efficiently consume events. This sample has two components, an observer and a consumer.

Here is the architecture diagram for this sample.

![Architecture Diagram](images/kafkapoc.jpg)

Here the observer is a code engine job which will run all the time, and it will look for events from multiple topics from the IBM Cloud Event streams instance. Once it gets a message/event from it, the observer triggers the consumer jobruns which will consume the events.

So here the observer works as a wake up mechanism for triggering the consumer jobruns, eliminating the need for your consumers to constantly check for the events.

The number of consumer jobruns triggered by the observer can be configured in this [config file](resources/kafkadata)

Here in this sample, the consumer is configured in such a way that once it begins consuming the events, it will automatically be terminated if it doesn't get any messages within one-minute timeframe.

// TODO: we need to decide where we configure the consumer groups for the consumers, it would be better, if can configure it in the kafkadata file.

Also, you can configure multiple consumers with different consumer groups for a topic.


## Prerequisites to run this sample :

- You should have your [IBM Cloud Events streams](https://cloud.ibm.com/eventstreams-provisioning/6a7f4e38-f218-48ef-9dd2-df408747568e/create) instance ready. Also, you have to create the topics from which the messages will be consumed.

- Create a [IBM Cloud Codeengine project](https://cloud.ibm.com/docs/codeengine?topic=codeengine-manage-project#create-a-project).

- Add the topics and jobDefinitions in the [kafkadata](resources/kafkadata) file. Template for Kafkadata file is:

```
<topic-name-1>
  partitions: <number-of-desired-pods>
  jobs:
  - <consumer-job-name-1>
  - <consumer-job-name-2>
<topic-name-2>
  partitions: <number-of-desired-pods>
  jobs:
  - <consumer-job-name>
```

- Set the required fields in the [run.sh](run.sh) file

- To test this sample, you need a producer which can send messages to the kafka topics, if you don't have you can create it in your code engine project by following the steps in this [doc](https://cloud.ibm.com/docs/codeengine?topic=codeengine-subscribe-kafka-tutorial).

## Running this sample

1. Login to ibm cloud

```
ibmcloud login --apikey <IBMCLOUD_API_KEY> -r <REGION_OF_CE_PROJECT> -g <RESOURCE_GROUP>
```

2. Select the code engine project.
```
ibmcloud ce project select --name <CE_PROJECT_NAME>
```

3. Execute `run.sh` file
```
./run.sh
```

Once you execute `run.sh`, it will create the necessary resources in your code engine project like secrets, configmaps, jobs etc and will start the observer in your codeengine project. Now you can send messages using your producer to the kafka topics, then the observer will watch for messages and runs the corresponding consumer jobruns based on the configuration in the [kafkadata](resources/kafkadata) file. 

**_NOTE:_**
If you created the producer app using the steps mentioned in the prerequisites, then you can run this command to send the events:

```
curl "<public_URL_of_Kafka_sender_app>?topic=<your_topic_name>&num=<number_of_messages_to_produce>"
```

You can clean the resources in the codeengine project by running this command
```
./run.sh clean
```
