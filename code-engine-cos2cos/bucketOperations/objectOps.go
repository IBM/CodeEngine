package bucketOperations

import (
	"fmt"
	"time"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
)

// Function to compare the time between object and timestamp given.
// Function returns 1 if lastBackupTime is more than object timestamp,
// 0 if same,
// -1 if less
// A positive value indicates that process is required.
func CompareUpdateTime(res *s3.Object, lastProcessTime time.Time) int {
	// If the object is null, return -1 instead of error stating no processing required
	if res == nil {
		return -1
	}
	if res.LastModified.Before(lastProcessTime) {
		return -1
	} else if res.LastModified.Equal(lastProcessTime) {
		return 0
	} else {
		return 1
	}
}

func (b *Bucket) CheckIfTagExists(objectKey string) (bool, error) {
	// Get object tags from COS
	resp, err := b.Client.GetObjectTagging(&s3.GetObjectTaggingInput{
		Bucket: aws.String(b.Name),
		Key:    aws.String(objectKey),
	})

	if err != nil {
		return false, fmt.Errorf("error getting object tags: %v", err)

	}
	tagKeyToCheck := "isInProcessing"

	// Iterate through the tags and check if the key exists
	for _, tag := range resp.TagSet {
		if *tag.Key == tagKeyToCheck {
			return true, nil
		}
	}
	return false, nil
}

func IsProcessingRequired(res *s3.Object, timestamp time.Time) bool {
	compareVal := CompareUpdateTime(res, timestamp)
	// A negative value indicates that process is required.
	return compareVal > 0
}

func (b *Bucket) GetObject(objectKey string) (*s3.GetObjectOutput, error) {
	client := b.Client
	bucketName := b.Name

	Input := &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
	}

	response, err := client.GetObject(Input)
	if err != nil {
		return nil, fmt.Errorf("error getting the object %w", err)
	}

	return response, nil
}

// Add a tag to the object (for example, a custom tag)
// The tag is added as a key-value pair
func (b *Bucket) AddTag(objectKey, tagKey, tagValue string) error {

	cosClient := b.Client
	tagging := &s3.PutObjectTaggingInput{
		Bucket: aws.String(b.Name),
		Key:    aws.String(objectKey),
		Tagging: &s3.Tagging{
			TagSet: []*s3.Tag{
				{
					Key:   aws.String(tagKey),
					Value: aws.String(tagValue),
				},
			},
		},
	}
	// Perform the tagging operation
	_, err := cosClient.PutObjectTagging(tagging)
	if err != nil {
		return fmt.Errorf("failed to add tag to object: %v", err)
	}

	return nil
}

// Delete the specified key from bucket object tags
func (b *Bucket) DeleteTag(objectKey, tagKey string) error {

	cosClient := b.Client

	// Perform the untagging operation
	_, err := cosClient.DeleteObjectTagging(&s3.DeleteObjectTaggingInput{
		Bucket: aws.String(b.Name),
		Key:    aws.String(objectKey),
	})

	if err != nil {
		return fmt.Errorf("failed to delete tag to object: %v", err)
	}
	return nil
}
