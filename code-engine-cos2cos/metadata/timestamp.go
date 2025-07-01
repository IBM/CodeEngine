package metadata

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"ibm.com/codeengine/cos2cos/bucketOperations"
	"ibm.com/codeengine/cos2cos/utils"
)

type TimestampData struct {
	Timestamp string `json:"timestamp"`
}

// Function to get the last time of process/processing
// If no argument is passed, It will try to find the file locally
// Pass bucket as a argument to fetch from bucket
// Note: Function will not return error if file is not found
func GetLastProcessTime(buckets ...*bucketOperations.Bucket) time.Time {

	// Function to load the timestamp file
	file, err := LoadTimestamp(buckets)

	// If err, meaning either I/O issue or no such file/object exist
	// So return zero valued time
	if err != nil {
		return time.Time{}
	}

	var data TimestampData
	err = json.Unmarshal(file, &data)

	if err != nil {
		return time.Time{}
	}

	timestamp, err := time.Parse(time.RFC3339, data.Timestamp)

	if err != nil {
		return time.Time{}
	}

	return timestamp
}

// Function to load timestamp file locally or using a object in Bucket
func LoadTimestamp(buckets []*bucketOperations.Bucket) ([]byte, error) {

	filename := os.Getenv("BUCKET_TIMESTAMP_FILENAME")

	if len(buckets) > 0 {
		bucket := buckets[0]
		res, err := bucket.GetObject(filename)

		if err != nil {
			return nil, err
		}

		return utils.ConvertObjectToByte(res)
	}
	// To load the timestamp metadata locally
	file, err := os.ReadFile(filename)

	return file, err

	// TODO: Add functionality to get modified time directly from bucket object instead of file. (saves processing)
	// As of now there is no otpion to get a last_modified_timestamp of a bucket.
}

// Function expects a timestamp as string in format "time.RFC3339"
func PutLastBackupTime(timestamp string, bucket ...*bucketOperations.Bucket) error {
	filename := os.Getenv("BUCKET_TIMESTAMP_FILENAME")

	if timestamp == "" {
		timestamp = time.Now().Format(time.RFC3339)
	}

	data := TimestampData{
		Timestamp: timestamp,
	}

	jsonData, err := json.Marshal(data)

	if err != nil {
		return fmt.Errorf("error marshaling JSON: %w", err)
	}

	return saveTimestamp(filename, jsonData, bucket)
}

// Function to update/create the file having last time process occured.
func saveTimestamp(filename string, jsonData []byte, bucket []*bucketOperations.Bucket) error {
	if len(bucket) > 0 {
		b := bucket[0]

		return b.UploadBytesToBucket(filename, jsonData)
	}
	// To save as local file, will overwrite the existing file
	return os.WriteFile(filename, jsonData, 0644)
}
