package main

import (
	"github.com/IBM/code-engine-go-sdk/codeenginev2"
	"github.com/IBM/sarama"
)

type JobInvoker struct {
	ProjectID  string
	CodeEngine *codeenginev2.CodeEngineV2
	JobMutexes *KeyedMutex
}

type JobRunInfo struct {
	JobRunToCreate map[string]int
}

type Clients struct {
	Client sarama.Client
	Admin  sarama.ClusterAdmin
}

type ConsumerGroup struct {
	Name             string
	JobName          string
	PartitionsOffset map[int32]int64
	topicName        string
}
type Topic struct {
	PartitionSize    int
	ConsumerGroups   []ConsumerGroup
	PartitionsOffset map[int32]int64
}

type Offsets interface {
	Clients() Clients

	GetTopicPartitionsOffset(string) map[int32]int64
	GetConsumerGroupTopicPartitionsOffset(string, string) map[int32]int64
	GetTopicPartitionSize(string) int
	IsAnyConsumerGroupOffsetModified(string, string) JobRunInfo
	IsTopicOffsetModified(string, map[int32]int64) bool
	IsConsumerGroupTopicOffsetModified(string, string, map[int32]int64) bool
}
