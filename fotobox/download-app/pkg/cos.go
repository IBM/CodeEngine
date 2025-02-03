package pkg

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/aws/credentials/ibmiam"
	"github.com/IBM/ibm-cos-sdk-go/aws/session"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
)

// Configuration for IBM COS
var (
	apiKey            = os.Getenv("apikey")
	serviceInstanceID = os.Getenv("resource_instance_id")
	authEndpoint      = "https://iam.cloud.ibm.com/identity/token"
	endpointURL       = "https://s3.direct.eu-de.cloud-object-storage.appdomain.cloud" 
	bucketName        = aws.String(os.Getenv("bucket"))                                
	region            = "eu-de"
)

const (
	thumbnailPrefix = "thumbnail-"
	downloadDir     = "./images"
	checkInterval   = 30 * time.Second // Frequency of checking for new images
)

// Initialize the IBM COS client with IAM authentication
func initCOSClient() *s3.S3 {
	// Set up IBM COS session with IAM credentials
	sess, err := session.NewSession(&aws.Config{
		Region:           aws.String(region), // Set the region for your COS instance
		Endpoint:         aws.String(endpointURL),
		S3ForcePathStyle: aws.Bool(true), // IBM COS requires path-style URLs
		Credentials: ibmiam.NewStaticCredentials(
			aws.NewConfig(),
			authEndpoint,
			apiKey,
			serviceInstanceID,
		),
	})
	if err != nil {
		log.Fatalf("Failed to create session: %v", err)
	}
	return s3.New(sess)
}

// Function to download all thumbnails and check periodically for new ones
func DownloadThumbnailsPeriodically() {
	client := initCOSClient()

	fmt.Println("Downloading images")
	for {

		// List all thumbnail files in the COS bucket
		err := listAndDownloadFiles(client, "thumbnail-")
		if err != nil {
			log.Printf("Error downloading thumbnails: %v", err)
		}

		// Wait before checking again
		time.Sleep(checkInterval)
	}
}
func DownloadImagesPeriodically() {
	client := initCOSClient()

	fmt.Println("Downloading images")
	for {

		// List all thumbnail files in the COS bucket
		err := listAndDownloadFiles(client, imageprefix)
		if err != nil {
			log.Printf("Error downloading thumbnails: %v", err)
		}

		// Wait before checking again
		time.Sleep(checkInterval)
	}
}

func DownloadIimagesWithPrefix() {
	client := initCOSClient()
	err := listAndDownloadFiles(client, "")
	if err != nil {
		log.Printf("Error downloading images: %v", err)
	}
}

// List and download new thumbnails
func listAndDownloadFiles(client *s3.S3, prefix string) error {
	input := &s3.ListObjectsV2Input{
		Bucket: bucketName,
		Prefix: aws.String(prefix),
	}

	// List objects in bucket with specified prefix
	result, err := client.ListObjectsV2(input)
	if err != nil {
		return fmt.Errorf("failed to list objects: %v", err)
	}

	// Ensure the download directory exists
	if err := os.MkdirAll(downloadDir, os.ModePerm); err != nil {
		return fmt.Errorf("failed to create download directory: %v", err)
	}

	// Iterate through objects and download new ones
	for _, item := range result.Contents {
		// fileName := "thumbnail-" + filepath.Base(*item.Key)
		fileName := filepath.Base(*item.Key)

		// Skip files already downloaded
		if fileExists(filepath.Join(downloadDir, fileName)) {
			log.Printf("Already downloaded: %s", fileName)
			continue
		}

		// Download the object
		err := downloadFile(client, *item.Key, filepath.Join(downloadDir, fileName))
		if err != nil {
			log.Printf("Failed to download %s: %v", fileName, err)
		} else {
			log.Printf("Downloaded: %s", fileName)
		}
	}
	return nil
}

// Download a file from COS
func downloadFile(client *s3.S3, key, filePath string) error {
	output, err := client.GetObject(&s3.GetObjectInput{
		Bucket: bucketName,
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to get object %s: %v", key, err)
	}
	defer output.Body.Close()

	// Create the file on local filesystem
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %v", filePath, err)
	}
	defer file.Close()

	// Write the object's data to the file
	_, err = file.ReadFrom(output.Body)
	if err != nil {
		return fmt.Errorf("failed to write to file %s: %v", filePath, err)
	}
	return nil
}
