package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/IBM/CodeEngine/kafka-observer/internal/cmd"
	"github.com/IBM/sarama"
)

var (
	version   = ""
	oldest    = true
	verbose   = false
	projectID string
)

func main() {

	config := cmd.GetConfigObserver([]string{
		cmd.ENV_MESSAGEHUB_BROKERS,
		cmd.ENV_IAM_API_KEY,
		cmd.ENV_MESSAGEHUB_USER,
		cmd.ENV_MESSAGEHUB_PWD,
		cmd.ENV_KAFKA_DATA,
	})

	km := &KeyedMutex{}
	log.Println("starting a new Kafka observer")

	if err := validateConfigKafkaCE(config); err != nil {
		log.Panicf("error detected in the current observer configuration: %v", err)
	}

	if verbose {
		sarama.Logger = log.New(os.Stdout, "[sarama] ", log.LstdFlags)
	}

	projectID = os.Getenv(cmd.CE_PROJECT_ID)
	if projectID == "" {
		log.Panicf("%s is not set", cmd.CE_PROJECT_ID)
	}

	observer, err := NewObserver(config)
	if err != nil {
		log.Panic(err)
	}

	jobInvoker, err := createJobInvoker(config.CEClient, projectID, km)
	if err != nil {
		log.Panic("failed to construct job invoker struct")
	}

	keepRunning := true

	ctx, cancel := context.WithCancel(context.Background())

	sigusr1 := make(chan os.Signal, 1)
	signal.Notify(sigusr1, syscall.SIGUSR1)

	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)

	type OffsetsToTopic struct {
		Topic         string
		ConsumerGroup string
		JobName       string
		Offset        map[int32]int64
	}

	offsetsCh := make(chan OffsetsToTopic)
	errCh := make(chan error)

	/*
	 One single loop on topics, in order
	 to spawn goroutines to calculate offsets.

	 We only send an offset value to the two channels,
	 if the new offset is different compared to the one
	 stored in Memory.
	*/

	for topicName, topic := range observer.Topics {
		go func(topic string) {
			ticker := time.Tick(500 * time.Millisecond) // should be configurable
			for range ticker {
				offset, err := observer.GetTopicPartitionsOffset(topic)
				if err != nil {
					errCh <- err
					continue
				}

				// auxFlag is an auxiliary flag to avoid
				// sending the offset to the channel, if the offset
				// was previously empty. This avoids creating idle pods.
				auxFlag := false
				if len(observer.Topics[topic].PartitionsOffset) == 0 {
					auxFlag = true
				}
				if observer.IsTopicOffsetModified(topic, offset) || auxFlag {
					// update the topic offset in memory
					observer.Topics[topic].PartitionsOffset = offset
					if !auxFlag {
						offsetsCh <- OffsetsToTopic{
							Topic:  topic,
							Offset: offset,
						}
					}
				}
			}
		}(topicName)

		go func(name string, consumerGroups []ConsumerGroup) {
			for i, consumerGroup := range consumerGroups {
				go func(topicName string, cg ConsumerGroup, index int) {
					ticker := time.Tick(500 * time.Millisecond) // should be configurable
					for range ticker {
						cgOffset, err := observer.GetConsumerGroupTopicPartitionsOffset(topicName, cg.Name)
						if err != nil {
							errCh <- err
							break
						}

						if observer.IsConsumerGroupTopicOffsetModified(topicName, cg.Name, cgOffset) || len(observer.Topics[topicName].ConsumerGroups[index].PartitionsOffset) == 0 {
							// update the consumer group offset in memory
							observer.Topics[topicName].ConsumerGroups[index].PartitionsOffset = cgOffset
						}
					}
				}(name, consumerGroup, i)
			}
		}(topicName, topic.ConsumerGroups)
	}

	/*
		An infinite loop to achieve the following:
		- Catch offsets from the general topics
		- Catch errors, only for logging
		- Catch signals
	*/
	for keepRunning {
		select {
		case incomingOffset := <-offsetsCh:
			log.Printf("consumed offset for topic: %v, offset: %v\n", incomingOffset.Topic, incomingOffset.Offset)
			if jobRunInfo := observer.IsAnyConsumerGroupOffsetModified(incomingOffset.Topic); len(jobRunInfo.JobRunToCreate) != 0 {
				for jobName, desiredPods := range jobRunInfo.JobRunToCreate {
					go func(t string, jobName string, podsCount int) {
						// Lock is required, as there well be cases where
						// multiple goroutines attempt to create jobruns for
						// the same job. This avoids creating unneeded pods.
						unlock := jobInvoker.JobMutexes.Lock(jobName)
						defer unlock()
						if err := jobInvoker.InvokeJobs(int64(podsCount), jobName); err != nil {
							log.Printf("error invoking jobs creation: %v", err)
						}
					}(incomingOffset.Topic, jobName, desiredPods)
				}
			}
		case err := <-errCh:
			log.Printf("error skipping all offsets calculations: %v", err)
		case <-ctx.Done():
			log.Println("terminating: context cancelled")
			keepRunning = false
		case <-sigterm:
			log.Println("terminating: via signal")
			keepRunning = false
		}
	}
	cancel()
}

func validateConfigKafkaCE(c cmd.Config) error {
	for topic, topicsToJobs := range c.KafkaCE {
		if len(topicsToJobs.Jobs) == 0 || topicsToJobs.Partitions == 0 {
			return fmt.Errorf("topic %s, is missing jobs or partitions definition, please verify your configmap values", topic)
		}
	}
	return nil
}
