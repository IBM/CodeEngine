package cmd

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"gopkg.in/yaml.v2"
)

const (
	ENV_MESSAGEHUB_BROKERS = "MESSAGEHUB_KAFKA_BROKERS_SASL"
	ENV_IAM_API_KEY        = "IAM_API_KEY"
	ENV_MESSAGEHUB_USER    = "MESSAGEHUB_USER"
	ENV_MESSAGEHUB_PWD     = "MESSAGEHUB_PASSWORD"
	ENV_KAFKA_DATA         = "kafkadata"

	KAFKA_TOPIC    = "KAFKA_TOPIC"
	CONSUMER_GROUP = "CONSUMER_GROUP"
	CE_PROJECT_ID  = "CE_PROJECT_ID"

	IDLE_TIMEOUT         = "IDLE_TIMEOUT"
	DEFAULT_IDLE_TIMEOUT = 60

	OBSERVER_TICKER         = "OBSERVER_TICKER" // in milliseconds
	DEFAULT_OBSERVER_TICKER = 500
)

// KafkaAuth holds required data
// to auth to Kafka Cluster. We load
// this from a K8S secret
type KafkaAuth struct {
	User  string `json:"user"`
	Token string `json:"token"`
}

// KafkaConsumer holds data about Kafka
type Kafka struct {
	Topics  []string `json:"topics"`
	Brokers []string `json:"brokers"`
}

type Job struct {
	Name          string `yaml:"name"`
	ConsumerGroup string `yaml:"consumer_group"`
}

type TopicsToJobs struct {
	Partitions int64 `json:"partitions"`
	Jobs       []Job `json:"jobs"`
}

// CEClient holds the data to authenticate
// to a CE Project
type CEClient struct {
	IamApiKey string `json:"iam_api_key"`
}

// Config is a wrapper around required
// config structs
type Config struct {
	CEClient  CEClient
	KafkaCE   map[string]TopicsToJobs
	Kafka     Kafka
	KafkaAuth KafkaAuth
}

func GetConfigConsumer(vars []string) Config {

	// bail out if any env variable is missing
	if err := validateEnvVars(vars); err != nil {
		log.Fatalf("error: %v", err)
	}

	brokers := retrieveMessageHubBrokers()

	return Config{
		Kafka: Kafka{
			Brokers: brokers,
		},
		KafkaAuth: KafkaAuth{
			User:  os.Getenv(ENV_MESSAGEHUB_USER),
			Token: os.Getenv(ENV_MESSAGEHUB_PWD),
		},
	}
}

func GetConfigObserver(vars []string) Config {

	// bail out if any env variable is missing
	if err := validateEnvVars(vars); err != nil {
		log.Fatalf("error: %v", err)
	}
	brokers := retrieveMessageHubBrokers()
	kafkace := getTopicsToJobs()

	return Config{
		Kafka: Kafka{
			Topics:  getKafkaTopics(kafkace),
			Brokers: brokers,
		},
		CEClient: CEClient{
			IamApiKey: os.Getenv(ENV_IAM_API_KEY),
		},
		KafkaAuth: KafkaAuth{
			User:  os.Getenv(ENV_MESSAGEHUB_USER),
			Token: os.Getenv(ENV_MESSAGEHUB_PWD),
		},
		KafkaCE: kafkace,
	}
}

func retrieveMessageHubBrokers() []string {
	// handle special cases for brokers list
	kafkaBrokers := os.Getenv(ENV_MESSAGEHUB_BROKERS)
	kafkaBrokers = strings.TrimPrefix(kafkaBrokers, "[")
	kafkaBrokers = strings.TrimSuffix(kafkaBrokers, "]")
	kafkaBrokers = strings.ReplaceAll(kafkaBrokers, "\"", "")

	return strings.Split(kafkaBrokers, ",")
}

func getTopicsToJobs() map[string]TopicsToJobs {
	kafkaData := os.Getenv(ENV_KAFKA_DATA)
	var kafkace map[string]TopicsToJobs
	err := yaml.Unmarshal([]byte(kafkaData), &kafkace)
	if err != nil {
		log.Fatalf("error unmarshalling kafka data: %v", err)
	}
	return kafkace
}

func getKafkaTopics(kafkace map[string]TopicsToJobs) []string {
	var topics []string
	for topic := range kafkace {
		topics = append(topics, topic)
	}
	return topics
}

func validateEnvVars(vars []string) error {
	errorList := []error{}
	for _, name := range vars {
		if _, exists := os.LookupEnv(name); !exists {
			errorList = append(errorList, fmt.Errorf("env var %v is not defined, missing", name))
		}
	}
	return errors.Join(errorList...)
}
