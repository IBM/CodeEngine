package bucketOperations

import (
	"bytes"
	"fmt"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/aws/credentials/ibmiam"
	"github.com/IBM/ibm-cos-sdk-go/aws/session"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
)

type Bucket struct {
	Name   string
	Client S3ClientInterface
}

// Interface that includes all sdk methods on which bucket depends.
type S3ClientInterface interface {
	HeadObject(input *s3.HeadObjectInput) (*s3.HeadObjectOutput, error)
	ListBuckets(input *s3.ListBucketsInput) (*s3.ListBucketsOutput, error)
	ListObjectsV2(input *s3.ListObjectsV2Input) (*s3.ListObjectsV2Output, error)
	ListObjectsV2Pages(input *s3.ListObjectsV2Input, fn func(*s3.ListObjectsV2Output, bool) bool) error
	GetObject(input *s3.GetObjectInput) (*s3.GetObjectOutput, error)
	PutObject(input *s3.PutObjectInput) (*s3.PutObjectOutput, error)
	GetObjectTagging(input *s3.GetObjectTaggingInput) (*s3.GetObjectTaggingOutput, error)
	PutObjectTagging(input *s3.PutObjectTaggingInput) (*s3.PutObjectTaggingOutput, error)
	DeleteObjectTagging(input *s3.DeleteObjectTaggingInput) (*s3.DeleteObjectTaggingOutput, error)
	DeleteObject(input *s3.DeleteObjectInput) (*s3.DeleteObjectOutput, error)
}

type CosSession struct {
	apiKey             string
	resourceInstanceID string
	serviceEndpoint    string
	region             string
	authEndpoint       string
	trustedProfileID   string
	crtokenFilePath    string
}

func NewCosClient(apiKey, resourceInstanceID, serviceEndpoint, region string, authEndpoint ...string) *s3.S3 {
	// fmt.Println("Creating cos Client")
	var authEndpointVal string
	if len(authEndpoint) == 0 {
		authEndpointVal = "https://iam.cloud.ibm.com/identity/token"
	} else {
		authEndpointVal = authEndpoint[0]
	}

	cosSession := CosSession{
		apiKey:             apiKey,
		resourceInstanceID: resourceInstanceID,
		serviceEndpoint:    serviceEndpoint,
		region:             region,
		authEndpoint:       authEndpointVal,
	}
	cosClient := cosSession.CreateIBMCOSSession()

	return cosClient
}

func NewCosClientTrustedProfile(trustedProfileID, crTokenFilePath, resourceInstanceID, serviceEndpoint, region string, authEndpoint ...string) *s3.S3 {
	var authEndpointVal string
	if len(authEndpoint) == 0 {
		authEndpointVal = "https://iam.cloud.ibm.com/identity/token"
	} else {
		authEndpointVal = authEndpoint[0]
	}

	cosSession := CosSession{
		resourceInstanceID: resourceInstanceID,
		serviceEndpoint:    serviceEndpoint,
		region:             region,
		authEndpoint:       authEndpointVal,
		trustedProfileID:   trustedProfileID,
		crtokenFilePath:    crTokenFilePath,
	}
	cosClient := cosSession.CreateIBMCOSSessionTrustedProfile()

	return cosClient
}

func NewBucket(name string, cosClient *s3.S3) *Bucket {

	configuredBucket := Bucket{
		Name:   name,
		Client: cosClient,
	}

	return &configuredBucket
}

// Helper function to create session client with provided config from bucket.
// Creating config using Service Credentials
func (c *CosSession) CreateIBMCOSSession() *s3.S3 {
	conf := aws.NewConfig().
		WithEndpoint(*aws.String(c.serviceEndpoint)).
		WithCredentials(ibmiam.NewStaticCredentials(aws.NewConfig(),
			c.authEndpoint, c.apiKey, c.resourceInstanceID)).
		WithRegion(c.region).
		WithS3ForcePathStyle(true)

	sess := session.Must(session.NewSession())
	client := s3.New(sess, conf)

	return client
}

func (c *CosSession) CreateIBMCOSSessionTrustedProfile() *s3.S3 {
	// Creating config using Trusted Profile
	conf := aws.NewConfig().
		WithEndpoint(*aws.String(c.serviceEndpoint)).
		WithCredentials(ibmiam.NewTrustedProfileCredentialsCR(aws.NewConfig(), c.authEndpoint, c.trustedProfileID, c.crtokenFilePath, c.resourceInstanceID)).
		WithRegion(c.region).
		WithS3ForcePathStyle(true)

	sess := session.Must(session.NewSession())
	client := s3.New(sess, conf)

	return client
}

// Function to list all the available buckets for a config.
func (b *Bucket) ListAvailableBuckets() (*s3.ListBucketsOutput, error) {

	// Create client
	// client := CreateIBMCOSSession()
	client := b.Client
	// Call Function
	d, err := client.ListBuckets(&s3.ListBucketsInput{})

	if err != nil {
		fmt.Println("Could not list the buckets")
		return nil, err
	}
	return d, nil
}

func (b *Bucket) ListBucketObjects() (*s3.ListObjectsV2Output, error) {
	bucketName := b.Name
	// fmt.Println("Listing Bucket Objects in Bucket:", bucketName)
	// Create client
	// client := CreateIBMCOSSession()
	client := b.Client

	// Call Function
	Input := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
	}
	// fmt.Println("Input object created", Input)
	objectList, e := client.ListObjectsV2(Input)

	if e != nil {
		fmt.Println("Error listing objects", e)
		return nil, e
	}

	return objectList, nil
}

func (b *Bucket) ListBucketObjectsPagination() (*s3.ListObjectsV2Output, error) {
	bucketName := b.Name
	// fmt.Println("Listing Bucket Objects in Bucket:", bucketName)
	// Create client
	// client := CreateIBMCOSSession()
	client := b.Client

	// Call Function
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
	}

	var allContents []*s3.Object

	err := client.ListObjectsV2Pages(input, func(page *s3.ListObjectsV2Output, lastPage bool) bool {
		for _, obj := range page.Contents {
			allContents = append(allContents, &s3.Object{
				Key:          obj.Key,
				LastModified: obj.LastModified,
			})
			fmt.Println(*obj.Key)
		}
		return true
	})
	if err != nil {
		fmt.Println("Error listing objects", err)
		return nil, err
	}

	combinedOutput := &s3.ListObjectsV2Output{
		Contents: allContents,
	}
	return combinedOutput, nil

}

func (bucket *Bucket) UploadBytesToBucket(objectKey string, data []byte) error {
	client := bucket.Client

	input := &s3.PutObjectInput{
		Bucket: aws.String(bucket.Name),
		Key:    aws.String(objectKey),
		Body:   bytes.NewReader(data),
	}

	_, err := client.PutObject(input)
	if err != nil {
		return fmt.Errorf("failed to upload data: %w", err)
	}

	return nil
}

// Function to upload a object to a bucket. - Not Tested.
/*
func (b *Bucket) UploadObjectToBucket(object *s3.GetObjectOutput) error {
	client := b.Client

	var buf bytes.Buffer
	_, err := buf.ReadFrom(object.Body)
	if err != nil {
		log.Fatalf("Unable to read object body: %v", err)
		return fmt.Errorf("Unable to read object body: %v", err)
	}

	_, err = client.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(destinationBucket),
		Key:    aws.String(destinationKey),
		Body:   bytes.NewReader(buf.Bytes()),
	})
	if err != nil {
		log.Fatalf("Unable to upload object to destination bucket: %v", err)
		return fmt.Errorf("Unable to upload object to destination bucket: %v", err)
	}
	return nil
}
*/

// Returns an error if the upload fails. - Unused
/*
func (b *Bucket) UploadFileToBucket(objectKey string, filePath string) error {

	// Create client
	// client := CreateIBMCOSSession()
	client := b.Client
	bucketName := b.Name

	// Read object into byte

	file, err := os.Open(filePath)

	if err != nil {
		log.Fatalf("Unable to open file: %v", err)
		return err
	}

	fileInfo, err := file.Stat()
	if err != nil {
		log.Fatalf("Unable to get file stats: %v", err)
		return err
	}
	fileBytes := make([]byte, fileInfo.Size())
	_, err = file.Read(fileBytes)

	if err != nil {
		log.Fatalf("Unable to read file: %v", err)
		return err
	}

	input := s3.PutObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
		Body:   bytes.NewReader(fileBytes),
	}

	// Call Function to upload (Put) an object
	_, _ = client.PutObject(&input)
	// fmt.Println(result)
	return nil
}
*/
