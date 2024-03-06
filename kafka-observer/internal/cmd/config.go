package cmd

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"gopkg.in/yaml.v2"
)

func getEnvVarsByName() [5]string {
	// Add any mandatory env variable
	// in here
	return [5]string{
		"BROKERS",
		"IAM_API_KEY",
		"KAFKA_USER",
		"KAFKA_TOKEN",
		"kafkadata",
	}
}

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

type TopicsToJobs struct {
	Partitions int64    `json:"partitions"`
	Jobs       []string `json:"jobs"`
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

func GetConfig() Config {

	// bail out if any env variable is missing
	if err := validateEnvVars(); err != nil {
		log.Fatalf("error: %v", err)
	}

	envVarsNames := getEnvVarsByName()

	// handle special cases for lists
	brokers := strings.Split(os.Getenv(envVarsNames[0]), ",")

	kafkaData := os.Getenv(envVarsNames[4])

	var kafkace map[string]TopicsToJobs

	err := yaml.Unmarshal([]byte(kafkaData), &kafkace)
	if err != nil {
		panic(err)
	}
	var topics []string
	for topic := range kafkace {
		topics = append(topics, topic)
	}

	return Config{
		Kafka: Kafka{
			Topics:  topics,
			Brokers: brokers,
		},
		CEClient: CEClient{
			IamApiKey: os.Getenv(envVarsNames[1]),
		},
		KafkaAuth: KafkaAuth{
			User:  os.Getenv(envVarsNames[2]),
			Token: os.Getenv(envVarsNames[3]),
		},
		KafkaCE: kafkace,
	}
}

func validateEnvVars() error {
	errorList := []error{}
	for _, name := range getEnvVarsByName() {
		if _, exists := os.LookupEnv(name); !exists {
			errorList = append(errorList, fmt.Errorf("env var %v is not defined, missing", name))
		}
	}
	return errors.Join(errorList...)
}
