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
	"github.com/IBM/code-engine-go-sdk/codeenginev2"
	"github.com/IBM/go-sdk-core/v5/core"
	"github.com/IBM/sarama"
)

var (
	version   = ""
	oldest    = true
	verbose   = false
	projectID string
)

type KeyedMutex struct {
	mutexes sync.Map // Zero value is empty and ready for use
}

func (m *KeyedMutex) Lock(key string) func() {
	value, _ := m.mutexes.LoadOrStore(key, &sync.Mutex{})
	mtx := value.(*sync.Mutex)
	mtx.Lock()

	return func() { mtx.Unlock() }
}

// Consumer implements the ConsumerGroupHandler
// interface
type Consumer struct {
	ready      chan bool
	ce         *codeenginev2.CodeEngineV2
	topicToJD  map[string]cmd.TopicsToJobs
	keyedMutex *KeyedMutex
}

func main() {

	config := cmd.GetConfig()
	km := &KeyedMutex{}

	if err := validateConfigKafkaCE(config); err != nil {
		log.Panicf("Error detected in the current observer configuration: %v", err)
	}

	keepRunning := true
	log.Println("Starting a new Kafka observer")

	if verbose {
		sarama.Logger = log.New(os.Stdout, "[sarama] ", log.LstdFlags)
	}

	ceService, err := GetCodeengineService(config.CEClient)
	if err != nil {
		log.Panic("failed to construct a CodeEngine API client")
	}

	projectID = os.Getenv("CE_PROJECT_ID")
	if projectID == "" {
		log.Panic("CE_PROJECT_ID is not set")
	}

	observerConsumerGroup := os.Getenv("OBSERVER_CONSUMER_GROUP")
	if observerConsumerGroup == "" {
		log.Printf("consumer group for the observer is not set, so it defaults to observer-group")
		observerConsumerGroup = "observer-group"
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
		ready:      make(chan bool),
		ce:         ceService,
		topicToJD:  config.KafkaCE,
		keyedMutex: km,
	}

	brokers := config.Kafka.Brokers

	ctx, cancel := context.WithCancel(context.Background())
	client, err := sarama.NewConsumerGroup(brokers, observerConsumerGroup, saramaConfig)
	if err != nil {
		log.Panicf("Error creating %s consumer group client: %v", observerConsumerGroup, err)
	}

	wg := &sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
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
	log.Printf("Observer up and running, listening to topics: %v\n", config.Kafka.Topics)

	sigusr1 := make(chan os.Signal, 1)
	signal.Notify(sigusr1, syscall.SIGUSR1)

	sigterm := make(chan os.Signal, 1)
	signal.Notify(sigterm, syscall.SIGINT, syscall.SIGTERM)

	for keepRunning {
		select {
		case <-ctx.Done():
			log.Println("terminating: context cancelled")
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
		select {
		case message, ok := <-claim.Messages():
			if !ok {
				log.Printf("message channel was closed")
				return nil
			}
			log.Printf("Message claimed: value = %s, timestamp = %v, topic = %s, partition = %v, offset = %v", string(message.Value), message.Timestamp, message.Topic, message.Partition, message.Offset)

			exists := false
			var topicConfig cmd.TopicsToJobs
			if topicConfig, exists = consumer.topicToJD[message.Topic]; !exists {
				// if topic is not known, we will ignore the msg.
				session.MarkMessage(message, "")
				continue
			}

			if len(topicConfig.Jobs) == 0 {
				// if no job is specified for the topic.
				session.MarkMessage(message, "")
				continue
			}

			failuresCounter := 0

			wg := &sync.WaitGroup{}

			var indices string
			var err error
			// jobrun creation happens inside a goroutine with a wait group
			for _, jd := range topicConfig.Jobs {
				wg.Add(1)
				go func(name string) {
					defer wg.Done()
					// Adding lock to avoid creation of jobruns by multiple threads at the same time
					unlock := consumer.keyedMutex.Lock(name)
					if indices, err = getArrayDesiredIndices(consumer.ce, name, consumer.topicToJD[message.Topic].Partitions); err != nil {
						log.Panicf("Error calculating desired array indices: %v", err)
					}
					if indices != "" {
						err := CreateJobrun(consumer.ce, name, indices)
						if err != nil {
							failuresCounter++
							log.Printf("creating Jobrun %s failed: %v", name, err)
							return
						}
					}
					unlock()
				}(jd)
			}
			wg.Wait()

			if failuresCounter > 0 {
				// dont commit the msg, retry
				return nil
			}

			session.MarkMessage(message, "")

		case <-session.Context().Done():
			log.Printf("completed")
			return nil
		}
	}
}

// GetCodeengineService returns a codeengine client
func GetCodeengineService(ceConfig cmd.CEClient) (*codeenginev2.CodeEngineV2, error) {
	authenticator := &core.IamAuthenticator{
		ApiKey:       ceConfig.IamApiKey,
		ClientId:     "bx",
		ClientSecret: "bx",
		URL:          "https://iam.cloud.ibm.com",
	}

	baseUrl := strings.ReplaceAll(os.Getenv("CE_API_BASE_URL"), "private.", "")
	if baseUrl == "" {
		baseUrl = codeenginev2.DefaultServiceURL
	} else {
		baseUrl = baseUrl + "/v2"
	}

	codeEngineService, err := codeenginev2.NewCodeEngineV2(&codeenginev2.CodeEngineV2Options{
		Authenticator: authenticator,
		URL:           baseUrl,
	})
	if err != nil {
		log.Printf("NewCodeEngineV2 error: %s\n", err.Error())
		return nil, err
	}
	return codeEngineService, nil
}

// CreateJobrun creates the jobrun for a job
func CreateJobrun(codeEngineService *codeenginev2.CodeEngineV2, job string, arraySpec string) error {
	createJobRunOptions := codeEngineService.NewCreateJobRunOptions(projectID)
	createJobRunOptions.SetJobName(job)
	createJobRunOptions.SetScaleArraySpec(arraySpec)

	log.Printf("Creating jobrun for job %s with arrayspec %s", job, arraySpec)
	result, _, err := codeEngineService.CreateJobRun(createJobRunOptions)
	if err != nil {
		return err
	}

	log.Printf("Jobrun %s created for job %s ", *result.Name, *result.JobName)

	retryTimes := 0

	for {
		getJobRunOptions := codeEngineService.NewGetJobRunOptions(
			projectID,
			*result.Name,
		)

		// For now ignoring error
		jr, _, _ := codeEngineService.GetJobRun(getJobRunOptions)
		var podsActive int64
		if jr != nil {
			if jr.StatusDetails != nil {
				if jr.StatusDetails.Requested != nil {
					podsActive += *jr.StatusDetails.Requested
				}
				if jr.StatusDetails.Running != nil {
					podsActive += *jr.StatusDetails.Running
				}
				if jr.StatusDetails.Pending != nil {
					podsActive += *jr.StatusDetails.Pending
				}
			}
		}
		if podsActive > 0 {
			log.Printf("Jobrun %s became active", *result.Name)
			break
		}

		if retryTimes > 4 {
			log.Printf("couldn't get the jobrun %s in 5 retries", *result.Name)
			return errors.New("couldn't get the jobrun " + *result.Name + "in 5 retries ")
		}

		time.Sleep(2 * time.Second)
		retryTimes++
	}
	return nil
}

// getArrayDesiredIndices returns the arrayspec for a jobrun based on JobRun array indices
func getArrayDesiredIndices(codeEngineService *codeenginev2.CodeEngineV2, jobName string, partitions int64) (string, error) {
	var alreadyCreated int64
	listJobRunsOptions := &codeenginev2.ListJobRunsOptions{
		ProjectID: core.StringPtr(projectID),
		JobName:   core.StringPtr(jobName),
		Limit:     core.Int64Ptr(int64(100)),
	}

	pager, err := codeEngineService.NewJobRunsPager(listJobRunsOptions)
	if err != nil {
		return "", err
	}

	var allResults []codeenginev2.JobRun
	for pager.HasNext() {
		nextPage, err := pager.GetNext()
		if err != nil {
			panic(err)
		}
		allResults = append(allResults, nextPage...)
	}

	if len(allResults) == 0 {
		log.Printf("new desired array indices value: %v", strconv.Itoa(int(partitions)))
		return fmt.Sprintf("0-%v", partitions-1), nil
	}

	for _, jr := range allResults {
		if jr.StatusDetails != nil {
			if jr.StatusDetails.Requested != nil {
				alreadyCreated += *jr.StatusDetails.Requested
			}
			if jr.StatusDetails.Running != nil {
				alreadyCreated += *jr.StatusDetails.Running
			}
			if jr.StatusDetails.Pending != nil {
				alreadyCreated += *jr.StatusDetails.Pending
			}
		}
	}
	newpods := partitions - alreadyCreated
	if newpods <= 0 {
		log.Printf("already created JobRuns instances are sufficient, nothing to do.")
		return "", nil
	}
	reqArraySpec := fmt.Sprintf("0-%v", newpods-1)
	log.Printf("new desired array indices value: %v", reqArraySpec)
	return reqArraySpec, nil
}

func validateConfigKafkaCE(c cmd.Config) error {
	for topic, topicsToJobs := range c.KafkaCE {
		if len(topicsToJobs.Jobs) == 0 || topicsToJobs.Partitions == 0 {
			return fmt.Errorf("topic %s, is missing jobs or partitions definition, please verify your configmap values", topic)
		}
	}
	return nil
}
