package main

// Simple add that will send an event (kafka message) to kafka.
// It sends it based on getting an HTTP request coming in.

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/IBM/sarama"
)

var producer sarama.SyncProducer

// This will setup our connection to Kafka.
// Nothing too special here, just setting up our Kafka client library based
// on the creds we have.
func init() {
	brokers := ""
	user := ""
	password := ""

	type CredStruct struct {
		Kafka_Brokers_SASL []string
		User               string
		Password           string
	}

	user = "token"

	if os.Getenv("PASSWORD") != "" {
		password = os.Getenv("PASSWORD")
	} else if os.Getenv("password") != "" {
		password = os.Getenv("password")
	} else {
		panic("Missing PASSWORD env var")
	}

	if os.Getenv("BROKERS") != "" {
		brokers = os.Getenv("BROKERS")
	} else if os.Getenv("brokers") != "" {
		brokers = os.Getenv("brokers")
	} else {
		panic("Missing BROKERS env var")
	}

	kVersion, err := sarama.ParseKafkaVersion("2.1.1")
	if err != nil {
		log.Printf("Error parsing Kafka version: %v", err)
		os.Exit(1)
	}

	log.Printf("User: %s", user)
	log.Printf("Password: %s", password[:5])
	log.Printf("Brokers: %s", brokers)

	// Make sure we're using TLS to talk to Event Streams
	config := sarama.NewConfig()
	config.Version = kVersion
	config.Net.SASL.Enable = true
	config.Net.SASL.Handshake = true
	config.Net.SASL.Mechanism = sarama.SASLTypePlaintext
	config.Net.TLS.Enable = true
	config.Net.SASL.User = user
	config.Net.SASL.Password = password

	config.Producer.RequiredAcks = sarama.WaitForAll
	config.Producer.Return.Successes = true
	producer, err = sarama.NewSyncProducer(strings.Split(brokers, ","), config)
	if err != nil {
		panic(fmt.Sprintf("Error connecting to Kafka: %s\n", err))
	}
}

func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	topic := "topic1"
	num := 1

	// Allow people to set a different topic
	if tmp, ok := r.URL.Query()["topic"]; ok {
		topic = tmp[0]
	}

	// Allow people to send more than one message
	if tmp, ok := r.URL.Query()["num"]; ok {
		num, _ = strconv.Atoi(tmp[0])
		if num < 1 {
			num = 1
		}
	}

	// Error check that we have a topic at all
	if topic == "" {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, "Missing 'topic' query parameter")
		return
	}

	log.Printf("Sending %d msg(s) to topic: %s", num, topic)
	for i := 0; i < num; i++ {
		msg := &sarama.ProducerMessage{
			Topic:     topic,
			Partition: -1,
			Headers: []sarama.RecordHeader{
				{
					Key:   []byte("Content-Type"),
					Value: []byte("application/json"),
				},
			},
			Value: sarama.StringEncoder(fmt.Sprintf("test1: %d", i+1)),
		}

		partition, offset, err := producer.SendMessage(msg)
		if err != nil {
			log.Printf("Part: %v  Offset: %v  Err: %s", partition, offset, err)
		}
	}
}

func main() {
	http.HandleFunc("/", HandleHTTP)
	log.Printf("Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
