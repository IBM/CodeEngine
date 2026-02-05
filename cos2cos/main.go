package main

import (
	"fmt"
	"os"

	"github.com/IBM/ibm-cos-sdk-go/service/s3"
	"github.com/joho/godotenv"
	"ibm.com/codeengine/cos2cos/bucketOperations"
	"ibm.com/codeengine/cos2cos/process"
)

// Note: When running the program in local env, pass false, false as cmd-line arg.
// Arg1: isInCodeEngine <- to load the env file from local Os.
// Arg2: isUsingTrustedProfile <- Works only with kubernetes cluster.
func main() {
	fmt.Println("Starting application with Job Index:", os.Getenv("JOB_INDEX"))

	// Default Values for running the program
	// Use service credentials and
	var isInCodeEngine bool = true
	var isUsingTrustedProfile bool = true

	// First argument states if the program is running in code engine env. (Default: Yes)
	if len(os.Args) > 1 {
		isInCodeEngine = os.Args[1] == "true"
		if !isInCodeEngine {
			os.Setenv("JOB_ARRAY_SIZE", "1")
			os.Setenv("JOB_INDEX", "0")
		}
	}

	// Second argument states if the program uses trustedProfile (Default: Yes)
	if len(os.Args) > 2 {
		isUsingTrustedProfile = os.Args[2] == "true"
	}

	if !isInCodeEngine {
		err := godotenv.Load()
		if err != nil {
			fmt.Println("Error loading env file")
			return
		}
	}

	fmt.Println("Any errors while processing objects:", processingMain(isUsingTrustedProfile))

	fmt.Println("Clsoing application")
}

// Function will initiate the buckets, sessions and trigger the StartProcessing function for actual processing
// accepts a boolean argument which decides how to create COS-Client (Using TrustedProfile or Service Credentials)
func processingMain(useTrustedProfile bool) error {
	// fmt.Println("hehe")

	var cosClient_PRIMARY, cosClient_SECONDARY *s3.S3

	if !useTrustedProfile {
		// Create a cosClient using Service Credentials
		cosClient_PRIMARY = bucketOperations.NewCosClient(os.Getenv("IBM_COS_API_KEY_PRIMARY"),
			os.Getenv("IBM_COS_RESOURCE_INSTANCE_ID_PRIMARY"),
			os.Getenv("IBM_COS_ENDPOINT_PRIMARY"),
			os.Getenv("IBM_COS_REGION_PRIMARY"),
		)

		cosClient_SECONDARY = bucketOperations.NewCosClient(os.Getenv("IBM_COS_API_KEY_SECONDARY"),
			os.Getenv("IBM_COS_RESOURCE_INSTANCE_ID_SECONDARY"),
			os.Getenv("IBM_COS_ENDPOINT_SECONDARY"),
			os.Getenv("IBM_COS_REGION_SECONDARY"),
		)
	} else {
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
	}

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
	// fmt.Println("hehe")
	// Initiate the process from primary bucket to secondary bucket
	// err := process.StartProcessing(primary_bucket, secondary_bucket)
	err := process.StartProcessingPagination(primary_bucket, secondary_bucket)
	if err != nil {
		return fmt.Errorf("\nBackup failed: %v", err)
	}

	fmt.Println("\nBackup completed successfully.")

	return nil
}
