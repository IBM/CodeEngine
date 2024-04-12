package main

import (
	"log"
	"os"

	"github.com/IBM/CodeEngine/kafka-observer/internal/cmd"
	"github.com/IBM/sarama"
)

type Observer struct {
	Topics map[string]*Topic
	Client Clients
}

func NewObserver(config cmd.Config) (*Observer, error) {
	observer := &Observer{}

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

	saramaClient, err := sarama.NewClient(config.Kafka.Brokers, saramaConfig)
	if err != nil {
		return nil, err
	}

	admin, err := sarama.NewClusterAdminFromClient(saramaClient)
	if err != nil {
		return nil, err
	}

	observer.Client = Clients{
		Client: saramaClient,
		Admin:  admin,
	}

	observer.Topics = make(map[string]*Topic)
	for topic, data := range config.KafkaCE {
		consumerGroupObject := []ConsumerGroup{}
		for _, job := range data.Jobs {
			consumerGroupObject = append(consumerGroupObject, ConsumerGroup{
				Name:      job.ConsumerGroup,
				JobName:   job.Name,
				topicName: topic,
			})
		}

		observer.Topics[topic] = &Topic{
			PartitionSize:    int(data.Partitions),
			ConsumerGroups:   consumerGroupObject,
			PartitionsOffset: map[int32]int64{},
		}
	}

	return observer, nil

}

// Clients give you back all available Sarama clients
func (o *Observer) Clients() Clients {
	return o.Client
}

// GetTopicPartitionSize gives the size of a topic partitions
func (o *Observer) GetTopicPartitionSize(topic string) int {
	return o.Topics[topic].PartitionSize
}

// GetTopicPartitionsOffset retrieves the offset of all partitions in a topic
// this is intended for the general topic, and should not be confuse with offsets
// from a consumergroup
func (o *Observer) GetTopicPartitionsOffset(topic string) (map[int32]int64, error) {
	partitionsOffset := make(map[int32]int64)
	partitions := o.GetTopicPartitionSize(topic)

	for i := 0; i < partitions; i++ {
		offset, err := o.Client.Client.GetOffset(topic, int32(i), sarama.OffsetNewest)
		if err != nil {
			return partitionsOffset, err
		}
		partitionsOffset[int32(i)] = offset
	}
	return partitionsOffset, nil
}

// GetConsumerGroupTopicPartitionsOffset retrieves the offset of all partitions in a topic
// from a consumergroup.
func (o *Observer) GetConsumerGroupTopicPartitionsOffset(topicName, consumerGroupName string) (map[int32]int64, error) {
	partitionsOffset := make(map[int32]int64)
	partitions := getPartitionsList(o.Topics[topicName].PartitionSize)
	fetchedOffsets, err := o.Clients().Admin.ListConsumerGroupOffsets(consumerGroupName, map[string][]int32{topicName: partitions})
	if err != nil {
		return partitionsOffset, err
	}

	for partition, block := range fetchedOffsets.Blocks[topicName] {
		partitionsOffset[partition] = block.Offset
	}
	return partitionsOffset, nil
}

// IsAnyConsumerGroupOffsetModified returns true if the topic partition offsets
// are higher than the consumer group partition offset, for the same topic.
func (o *Observer) IsAnyConsumerGroupOffsetModified(topic string) JobRunInfo {

	topicObject := o.Topics[topic]

	jobRunInfo := JobRunInfo{}
	jobRunInfo.JobRunToCreate = make(map[string]int)
	for _, c := range topicObject.ConsumerGroups {
		count := 0
		for partition, offset := range c.PartitionsOffset {
			if topicObject.PartitionsOffset[partition] > offset && topicObject.PartitionsOffset[partition]!=0 {
				log.Printf("topicOffset: %v/%v, consumerGroupOffset(%v): %v/%v", partition, topicObject.PartitionsOffset[partition], c.Name, partition, offset)
				count++
			}
			jobRunInfo.JobRunToCreate[c.JobName] = count
		}
	}

	return jobRunInfo
}

// IsTopicOffsetModified returns true if the offset stored in memory
// isnt the same as the provided, this only applies for general offsets
func (o *Observer) IsTopicOffsetModified(topicName string, newOffset map[int32]int64) bool {
	for partition, offset := range o.Topics[topicName].PartitionsOffset {
		if newOffset[partition] != offset {
			return true
		}
	}
	return false
}

// IsConsumerGroupTopicOffsetModified returns true if the offset stored in memory
// isnt the same as the provided, this only applies for offsets from consumergroups
func (o *Observer) IsConsumerGroupTopicOffsetModified(topicName, cgName string, newOffset map[int32]int64) bool {
	for _, consumerGroup := range o.Topics[topicName].ConsumerGroups {
		if consumerGroup.Name == cgName {
			for partition, offset := range consumerGroup.PartitionsOffset {
				if newOffset[partition] != offset {
					return true
				}
			}
		}
	}
	return false
}

func getPartitionsList(partitionSize int) []int32 {
	partitions := []int32{}
	for i := 0; i < partitionSize; i++ {
		partitions = append(partitions, int32(i))
	}
	return partitions
}
