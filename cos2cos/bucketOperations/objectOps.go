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
		return false, fmt.Errorf("Error getting object tags: %v", err)

	}
	tagKeyToCheck := "isInProcessing"

	// Iterate through the tags and check if the key exists
	for _, tag := range resp.TagSet {
		if *tag.Key == tagKeyToCheck {
			// fmt.Println(tag)
			return true, nil
		}
	}
	return false, nil
}

func IsProcessingRequired(res *s3.Object, timestamp time.Time) bool {
	compareVal := CompareUpdateTime(res, timestamp)
	// fmt.Printf("The time for last process is: %s\nObject last time:%s\n", timestamp.String(), res.LastModified.String())
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

/*
Function to store the object in a file in local storage
func StoreObject(objectKey string, response *s3.GetObjectOutput) error {

	tempFile, err := os.Create(fmt.Sprintf("temp/%s", objectKey))

	if err != nil {
		log.Fatal(err)
	}

	// Read from response body
	_, err = tempFile.ReadFrom(response.Body)

	if err != nil {
		return err
	}
	return nil
}
*/

/*
// Function to get the metadata of an object without getting the object itself - Unused
func (b *Bucket) GetObjectMetadata(objectKey string) (*s3.HeadObjectOutput, error) {
	client := b.Client
	bucketName := b.Name

	input := &s3.HeadObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
	}

	result, err := client.HeadObject(input)
	if err != nil {
		// log.Fatalf("Failed to retrieve metadata: %v", err)
		return nil, err
	}

	// fmt.Println("Metadata for object:", objectKey)
	// fmt.Printf("Last Modified: %v\n", result.LastModified)
	// fmt.Printf("Size: %d bytes\n", *result.ContentLength)
	// fmt.Printf("Content-Type: %s\n", *result.ContentType)
	// fmt.Printf("ETag: %s\n", *result.ETag)

	// Print custom metadata
	if result.Metadata != nil {
		fmt.Println("Custom Metadata:")
		for key, value := range result.Metadata {
			fmt.Printf("%s: %s\n", key, *value)
		}
	}

	return result, nil
}
*/
// test

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
	// fmt.Printf("Tag Deleted successfully from the object: %s\n", objectKey)
	return nil
}
