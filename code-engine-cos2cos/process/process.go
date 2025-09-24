package process

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"ibm.com/codeengine/cos2cos/bucketOperations"
	"ibm.com/codeengine/cos2cos/metadata"
	"ibm.com/codeengine/cos2cos/userDefinedProcess"
	"ibm.com/codeengine/cos2cos/utils"
)

// Function to List all the objects that are required for processing
func ListAllObjectsForProcessing(b *bucketOperations.Bucket, last_time_modified time.Time) ([]string, error) {
	// Get all objects
	objects, err := b.ListBucketObjects()

	if err != nil {
		return nil, fmt.Errorf("could not fetch bucket:%s objects\nError:%w", b.Name, err)
	}

	array_size, _ := strconv.ParseInt(os.Getenv("JOB_ARRAY_SIZE"), 10, 32)
	cur_job_index, _ := strconv.ParseInt(os.Getenv("JOB_INDEX"), 10, 32)

	requiredObjectsKey := make([]string, 0)

	for _, object := range objects.Contents {
		jobIndex := getObjectIndex(*object.Key, array_size)
		if jobIndex == cur_job_index {
			exists, err := b.CheckIfTagExists(*object.Key)
			if err != nil {
				return nil, err
			}
			if bucketOperations.IsProcessingRequired(object, last_time_modified) && !exists {
				requiredObjectsKey = append(requiredObjectsKey, *object.Key)
			}
		}
	}
	return requiredObjectsKey, nil
}

func ListAllObjectsForProcessingPagination(b *bucketOperations.Bucket, last_time_modified time.Time) ([]string, error) {
	// Get all objects
	objectsAllPages, err := b.ListBucketObjectsPagination()
	fmt.Print(objectsAllPages)
	if err != nil {
		return nil, fmt.Errorf("could not fetch bucket:%s objects\nError:%w", b.Name, err)
	}

	array_size, _ := strconv.ParseInt(os.Getenv("JOB_ARRAY_SIZE"), 10, 32)
	cur_job_index, _ := strconv.ParseInt(os.Getenv("JOB_INDEX"), 10, 32)

	requiredObjectsKey := make([]string, 0)

	for _, object := range objectsAllPages.Contents {
		jobIndex := getObjectIndex(*object.Key, array_size)
		if jobIndex == cur_job_index {
			exists, err := b.CheckIfTagExists(*object.Key)
			if err != nil {
				return nil, err
			}
			if bucketOperations.IsProcessingRequired(object, last_time_modified) && !exists {
				requiredObjectsKey = append(requiredObjectsKey, *object.Key)
			}
		}
	}
	return requiredObjectsKey, nil
}

// The function returns the job index that will be used to process the object
// Based on Alphabetical Order. Should be modified by User as per use-case.
func getObjectIndex(object string, array_size int64) int64 {
	object = strings.ToLower(object)

	num := int64(object[0] - 'a')

	return num % array_size
}

func StartProcessing(primary_bucket *bucketOperations.Bucket, secondary_bucket *bucketOperations.Bucket) error {
	// Get the time of process which will be updated later on
	newBackupTime := time.Now().Format(time.RFC3339)

	// Passing primary_bucket b to get the timestamp from secondary_bucket
	last_time_modified := metadata.GetLastProcessTime(secondary_bucket)

	// Get the list of all the objects that are modified
	keys, err := ListAllObjectsForProcessing(primary_bucket, last_time_modified)

	if err != nil {
		return fmt.Errorf("error Fetching Objects for processing: %w", err)
	}
	fmt.Println("\n*** Objects that are to be processed:\n", keys)
	// Channels for each process object that gives bool values as return type
	errorChans := make([]chan error, 0)

	for _, key := range keys {
		errorChan := make(chan error)
		errorChans = append(errorChans, errorChan)
		// Call the process function
		// This function will fetch the object as well as save it back to another bucket
		go processObject(key, primary_bucket, secondary_bucket, errorChan)
	}

	//Wait for all the processObject calls
	var isAllSuccess bool = true
	for index := range len(errorChans) {
		err := <-errorChans[index]
		if err != nil {
			fmt.Println("Error processing object:", err)
			isAllSuccess = false
		}
	}
	if !isAllSuccess {
		return err
	}
	// Update the metadata
	// Passing secondary_bucket to store the file in secondary_bucket
	metadata.PutLastBackupTime(newBackupTime, secondary_bucket)

	return nil
}

func StartProcessingPagination(primary_bucket *bucketOperations.Bucket, secondary_bucket *bucketOperations.Bucket) error {
	// Get the time of process which will be updated later on
	newBackupTime := time.Now().Format(time.RFC3339)

	// Passing primary_bucket b to get the timestamp from secondary_bucket
	last_time_modified := metadata.GetLastProcessTime(secondary_bucket)

	// Get the list of all the objects that are modified
	keys, err := ListAllObjectsForProcessingPagination(primary_bucket, last_time_modified)

	if err != nil {
		return fmt.Errorf("error Fetching Objects for processing: %w", err)
	}
	fmt.Println("\n*** Objects that are to be processed:\n", keys)
	// Channels for each process object that gives bool values as return type
	errorChans := make([]chan error, 0)

	for _, key := range keys {
		errorChan := make(chan error)
		errorChans = append(errorChans, errorChan)
		// Call the process function
		// This function will fetch the object as well as save it back to another bucket
		go processObject(key, primary_bucket, secondary_bucket, errorChan)
	}

	//Wait for all the processObject calls
	var isAllSuccess bool = true
	for index := range len(errorChans) {
		err := <-errorChans[index]
		if err != nil {
			fmt.Println("Error processing object:", err)
			isAllSuccess = false
		}
	}
	if !isAllSuccess {
		return err
	}
	// Update the metadata
	// Passing secondary_bucket to store the file in secondary_bucket
	metadata.PutLastBackupTime(newBackupTime, secondary_bucket)

	return nil
}

func processObject(key string, primary_bucket *bucketOperations.Bucket, secondary_bucket *bucketOperations.Bucket, errorChan chan error) error {
	// Adding a tag to it, value is the jobrun name
	err := primary_bucket.AddTag(key, "isInProcessing", os.Getenv("CE_JOBRUN"))
	if err != nil {
		errorChan <- fmt.Errorf("failed to add tag to object: %w", err)
		return err
	}

	defer primary_bucket.DeleteTag(key, "isInProcessing")

	//Get the object
	object, err := primary_bucket.GetObject(key)
	if err != nil {
		errorChan <- fmt.Errorf("failed to fetch object: %w", err)
		return err
	}

	// 1. Let the user get the bytes and process it
	// Convert to Bytes
	objectBytes, err := utils.ConvertObjectToByte(object)
	if err != nil {
		errorChan <- fmt.Errorf("error retriving the object for processing")
		return fmt.Errorf("error retriving the object for processing")
	}

	processedBytes, err := userDefinedProcess.UserDefinedProcessObjectBytes(objectBytes)
	if err != nil {
		errorChan <- fmt.Errorf("failed to process the object: %w", err)
		return err
	}

	err = secondary_bucket.UploadBytesToBucket(key, processedBytes)
	if err != nil {
		errorChan <- fmt.Errorf("failed to upload the object: %w", err)
		return err
	}

	errorChan <- nil
	close(errorChan)
	return nil
}
