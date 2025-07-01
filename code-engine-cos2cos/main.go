package main

import (
	"fmt"
	"os"

	"github.com/IBM/ibm-cos-sdk-go/service/s3"
	"ibm.com/codeengine/cos2cos/bucketOperations"
	"ibm.com/codeengine/cos2cos/process"
)

func main() {
	fmt.Println("Starting application with Job Index:", os.Getenv("JOB_INDEX"))

	// Setting default values
	os.Setenv("IBM_COS_CRTokenFilePath_PRIMARY", "/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token")
	os.Setenv("IBM_COS_CRTokenFilePath_SECONDARY", "/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token")
	os.Setenv("BUCKET_TIMESTAMP_FILENAME", "last_modified_time.json")

	fmt.Println("Any errors while processing objects:", processingMain())

	fmt.Println("Closing application")
}

// Function will initiate the buckets, sessions and trigger the StartProcessing function for actual processing
// accepts a boolean argument which decides how to create COS-Client (Using TrustedProfile or Service Credentials)
func processingMain() error {
	var cosClient_PRIMARY, cosClient_SECONDARY *s3.S3

	// Create a cosClient using Trusted Profile
	cosClient_PRIMARY = bucketOperations.NewCosClientTrustedProfile(os.Getenv("IBM_COS_TRUSTED_PROFILE_ID_PRIMARY"),
		os.Getenv("IBM_COS_CRTokenFilePath_PRIMARY"),
		os.Getenv("IBM_COS_RESOURCE_INSTANCE_ID_PRIMARY"),
		os.Getenv("IBM_COS_ENDPOINT_PRIMARY"),
		os.Getenv("IBM_COS_REGION_PRIMARY"),
	)

	cosClient_SECONDARY = bucketOperations.NewCosClientTrustedProfile(os.Getenv("IBM_COS_TRUSTED_PROFILE_ID_SECONDARY"),
		os.Getenv("IBM_COS_CRTokenFilePath_SECONDARY"),
		os.Getenv("IBM_COS_RESOURCE_INSTANCE_ID_SECONDARY"),
		os.Getenv("IBM_COS_ENDPOINT_SECONDARY"),
		os.Getenv("IBM_COS_REGION_SECONDARY"),
	)

	// Creating Primary bucket instance
	primary_bucket := bucketOperations.NewBucket(
		os.Getenv("PRIMARY_COS_BUCKET_NAME"),
		cosClient_PRIMARY,
	)

	// Creating secondary bucket instance
	secondary_bucket := bucketOperations.NewBucket(
		os.Getenv("SECONDARY_COS_BUCKET_NAME"),
		cosClient_SECONDARY,
	)
	// Initiate the process from primary bucket to secondary bucket
	// err := process.StartProcessing(primary_bucket, secondary_bucket)
	err := process.StartProcessingPagination(primary_bucket, secondary_bucket)
	if err != nil {
		return fmt.Errorf("\nProcessing failed: %v", err)
	}

	fmt.Println("\nProcessing completed successfully.")

	return nil
}
