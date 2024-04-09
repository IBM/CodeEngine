package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
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
	ready   chan bool
	timeout int
}

func main() {
	fmt.Println("retrieving config")

	config := cmd.GetConfigConsumer([]string{
		cmd.ENV_MESSAGEHUB_BROKERS,
		cmd.ENV_MESSAGEHUB_USER,
		cmd.ENV_MESSAGEHUB_PWD,
	})

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
		ready:   make(chan bool),
		timeout: cmd.DEFAULT_IDLE_TIMEOUT,
	}

	// Handle idle timeout init
	if idleTimeOut, exists := os.LookupEnv(cmd.IDLE_TIMEOUT); exists {
		timeOut, err := strconv.Atoi(idleTimeOut)
		if err != nil {
			log.Panicf("error parsing %s duration: %v", cmd.IDLE_TIMEOUT, err)
		}
		consumer.timeout = timeOut
	}

	log.Printf("idle timeout of consumer set to %v seconds", consumer.timeout)

	brokers := config.Kafka.Brokers
	topics := strings.Split(os.Getenv(cmd.KAFKA_TOPIC), ",")

	ctx, cancel := context.WithCancel(context.Background())

	consumerGroup := os.Getenv(cmd.CONSUMER_GROUP)

	client, err := sarama.NewConsumerGroup(brokers, consumerGroup, saramaConfig)
	if err != nil {
		log.Panicf("error creating consumer group client: %v", err)
	}

	wg := &sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			if err := client.Consume(ctx, topics, &consumer); err != nil {
				if errors.Is(err, sarama.ErrClosedConsumerGroup) {
					return
				}
				log.Panicf("error from consumer: %v", err)
			}
			if ctx.Err() != nil {
				return
			}
			consumer.ready = make(chan bool)
		}
	}()

	<-consumer.ready
	log.Println("sarama consumer up and running!...")

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
		log.Panicf("error closing client: %v", err)
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
		idleTimer.Reset(time.Second * time.Duration(consumer.timeout))
		select {
		case message, ok := <-claim.Messages():
			if !ok {
				log.Printf("message channel was closed")
				return nil
			}
			log.Printf("message claimed: key= %s, value = %s, timestamp = %v, latency = %s, topic = %s, partition = %v, offset = %v", string(message.Key), string(message.Value), message.Timestamp, time.Since(message.Timestamp), message.Topic, message.Partition, message.Offset)
			session.MarkMessage(message, "")
		case <-session.Context().Done():
			log.Printf("completed")
			return nil
		}
	}
}
