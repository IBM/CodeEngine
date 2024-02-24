package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/IBM/CodeEngine/kafka-observer/internal/cmd"
	"github.com/IBM/sarama"
)

var (
	version = ""
	oldest  = true
	verbose = false
)

var idleTimer *time.Timer

// Consumer implements the ConsumerGroupHandler
// interface
type Consumer struct {
	ready chan bool
	// ce        *codeenginev2.CodeEngineV2
	topicToJD map[string]cmd.TopicsToJobs
}

func main() {
	fmt.Println("retrieving config")

	config := cmd.GetConfig()

	keepRunning := true
	log.Println("Starting a new Sarama consumer")

	if verbose {
		sarama.Logger = log.New(os.Stdout, "[sarama] ", log.LstdFlags)
	}

	version = sarama.DefaultVersion.String()
	version, err := sarama.ParseKafkaVersion(version)
	if err != nil {
		log.Panicf("Error parsing Kafka version: %v", err)
	}

	saramaConfig := sarama.NewConfig()
	saramaConfig.Version = version
	saramaConfig.Consumer.Offsets.AutoCommit.Enable = true
	saramaConfig.ClientID, _ = os.Hostname()
	saramaConfig.Net.SASL.Enable = true
	saramaConfig.Net.SASL.User = config.KafkaAuth.User
	saramaConfig.Net.SASL.Password = config.KafkaAuth.Token
	saramaConfig.Net.TLS.Enable = true

	if oldest {
		saramaConfig.Consumer.Offsets.Initial = sarama.OffsetOldest
	}

	saramaConfig.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{sarama.NewBalanceStrategyRoundRobin()}

	consumer := Consumer{
		ready: make(chan bool),
		// ce:        ceService,
		topicToJD: config.KafkaCE,
	}

	brokers := config.Kafka.Brokers

	ctx, cancel := context.WithCancel(context.Background())
	client, err := sarama.NewConsumerGroup(brokers, "consuming-group", saramaConfig)
	if err != nil {
		log.Panicf("Error creating consumer group client: %v", err)
	}

	wg := &sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			// TODO: fix topics, cannot use all
			if err := client.Consume(ctx, config.Kafka.Topics, &consumer); err != nil {
				if errors.Is(err, sarama.ErrClosedConsumerGroup) {
					return
				}
				log.Panicf("Error from consumer: %v", err)
			}
			if ctx.Err() != nil {
				return
			}
			consumer.ready = make(chan bool)
		}
	}()

	<-consumer.ready
	log.Println("Sarama consumer up and running!...")

	sigusr1 := make(chan os.Signal, 1)
	signal.Notify(sigusr1, syscall.SIGUSR1)

	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)

	idleTimer = time.NewTimer(time.Second * 100)
	defer idleTimer.Stop()

	for keepRunning {
		select {
		case <-ctx.Done():
			log.Println("terminating: context cancelled")
			keepRunning = false
		case <-idleTimer.C:
			log.Println("we are done, timeout expired")
			keepRunning = false
		case <-sigterm:
			log.Println("terminating: via signal")
			keepRunning = false
		}
	}
	cancel()
	wg.Wait()
	if err = client.Close(); err != nil {
		log.Panicf("Error closing client: %v", err)
	}
}

func (consumer *Consumer) Setup(sarama.ConsumerGroupSession) error {
	close(consumer.ready)
	return nil
}

func (consumer *Consumer) Cleanup(sarama.ConsumerGroupSession) error {
	return nil
}

func (consumer *Consumer) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for {
		idleTimer.Reset(time.Second * 60)
		select {
		case message, ok := <-claim.Messages():
			if !ok {
				log.Printf("message channel was closed")
				return nil
			}
			log.Printf("Message claimed: value = %s, timestamp = %v, topic = %s, partition = %v, offset = %v", string(message.Value), message.Timestamp, message.Topic, message.Partition, message.Offset)
			session.MarkMessage(message, "")
		case <-session.Context().Done():
			log.Printf("completed")
			return nil
		}
	}
}
