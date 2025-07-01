package process

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
	"github.com/stretchr/testify/mock"

	"ibm.com/codeengine/cos2cos/bucketOperations"
	mockS3 "ibm.com/codeengine/cos2cos/mock"
	"ibm.com/codeengine/cos2cos/utils"
)

func TestBackup(t *testing.T) {
	gomega.RegisterFailHandler(ginkgo.Fail)
	ginkgo.RunSpecs(t, "Backup Suite")
}

var _ = ginkgo.Describe("getObjectIndex", func() {

	getObjectIndexTestCases := []struct {
		description    string
		ObjectKey      string
		array_size     int64
		expectedResult int64
	}{
		{
			description:    "When object name start with a",
			ObjectKey:      "atestfile",
			array_size:     26,
			expectedResult: 0,
		},
		{
			description:    "When object name start with a, array size 27",
			ObjectKey:      "atestfile",
			array_size:     27,
			expectedResult: 0,
		},
		{
			description:    "When array size exceed 26",
			ObjectKey:      "atestfile",
			array_size:     99,
			expectedResult: 0,
		},
		{
			description:    "When object name start with z, array size 26",
			ObjectKey:      "ztestfile",
			array_size:     26,
			expectedResult: 25,
		},
		{
			description:    "When object name start with z, array size 13",
			ObjectKey:      "ztestfile",
			array_size:     13,
			expectedResult: 12,
		},
		{
			description:    "When object name start with b, array size is 12",
			ObjectKey:      "btestfile",
			array_size:     12,
			expectedResult: 1,
		},
		{
			description:    "When object name start with d, array size is 12",
			ObjectKey:      "dtestfile",
			array_size:     12,
			expectedResult: 3,
		},
		{
			description:    "When object name start with z, array size is 12",
			ObjectKey:      "ztestfile",
			array_size:     12,
			expectedResult: 1,
		},
		{
			description:    "When array size is 1",
			ObjectKey:      "rtestfile",
			array_size:     1,
			expectedResult: 0,
		},
		{
			description:    "When array size is 2",
			ObjectKey:      "ttestfile",
			array_size:     2,
			expectedResult: 1,
		},
	}

	for _, tc := range getObjectIndexTestCases {

		ginkgo.It(tc.description, func() {
			res := getObjectIndex(tc.ObjectKey, tc.array_size)

			gomega.Expect(res).To(gomega.Equal(tc.expectedResult))
		})
	}
})

var _ = ginkgo.Describe("ListAllObjectsForProcessing", func() {
	// Mimic the Code Engine Parallel Job Instance call to this function
	os.Setenv("JOB_ARRAY_SIZE", "26")

	//Setup the mock bucket
	var (
		mockClient *mockS3.MockS3Client
		bucket     *bucketOperations.Bucket
	)

	// Setup before each test
	ginkgo.BeforeEach(func() {
		mockClient = new(mockS3.MockS3Client)
		bucket = &bucketOperations.Bucket{
			Name:   "test-bucket",
			Client: mockClient, // Inject mock client for testing
		}
	})
	testCases := []struct {
		description        string
		mockOutput         *s3.ListObjectsV2Output
		last_time_modified time.Time
		mockError          error
		expectedOutput     []string
		expectedError      error
		JOB_INDEX          int
	}{
		{
			description:        "2 files, job index 0, both need update",
			last_time_modified: utils.ParseTime("2025-02-07T09:49:42Z"),
			mockOutput: &s3.ListObjectsV2Output{
				Contents: []*s3.Object{
					{Key: aws.String("a_object1"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
					{Key: aws.String("b_object2"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
				},
			},
			mockError:      nil,
			JOB_INDEX:      0,
			expectedOutput: []string{"a_object1"},
			expectedError:  nil,
		},
		{
			description:        "2 files, job index 1, both need update",
			last_time_modified: utils.ParseTime("2025-02-07T09:49:42Z"),
			mockOutput: &s3.ListObjectsV2Output{
				Contents: []*s3.Object{
					{Key: aws.String("a_object1"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
					{Key: aws.String("b_object2"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
				},
			},
			mockError:      nil,
			JOB_INDEX:      2,
			expectedOutput: []string{},
			expectedError:  nil,
		},
		{
			description:        "2 files, no need update",
			last_time_modified: utils.ParseTime("2025-04-07T09:49:42Z"),
			mockOutput: &s3.ListObjectsV2Output{
				Contents: []*s3.Object{
					{Key: aws.String("a_object1"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
					{Key: aws.String("b_object2"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
				},
			},
			mockError:      nil,
			JOB_INDEX:      0,
			expectedOutput: []string{},
			expectedError:  nil,
		},
		{
			description:        "2 files, both need update",
			last_time_modified: utils.ParseTime("2025-02-07T09:49:42Z"),
			mockOutput: &s3.ListObjectsV2Output{
				Contents: []*s3.Object{
					{Key: aws.String("a_object1"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
					{Key: aws.String("a_object2"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
				},
			},
			mockError:      nil,
			JOB_INDEX:      0,
			expectedOutput: []string{"a_object1", "a_object2"},
			expectedError:  nil,
		},
		{
			description:        "no files",
			last_time_modified: utils.ParseTime("2025-02-07T09:49:42Z"),
			mockOutput: &s3.ListObjectsV2Output{
				Contents: []*s3.Object{},
			},
			mockError:      errors.New("not fetch objects"),
			JOB_INDEX:      0,
			expectedOutput: []string{},
			expectedError:  errors.New("not fetch objects"),
		},
	}

	for _, tc := range testCases {
		ginkgo.It(tc.description, func() {
			os.Setenv("JOB_INDEX", fmt.Sprint(tc.JOB_INDEX))
			mockClient.On("ListObjectsV2", mock.Anything).Return(tc.mockOutput, tc.mockError)
			mockClient.On("GetObjectTagging", mock.Anything).Return(&s3.GetObjectTaggingOutput{}, nil)
			output, err := ListAllObjectsForProcessing(bucket, tc.last_time_modified)
			fmt.Println(output)
			if tc.expectedError != nil {
				gomega.Expect(err).ToNot(gomega.BeNil())
			} else {
				gomega.Expect(output).To(gomega.Equal(tc.expectedOutput))
				gomega.Expect(err).To(gomega.BeNil())
			}
		})
	}
	ginkgo.It("Tag Error", func() {
		os.Setenv("JOB_INDEX", "0")
		mockClient.On("ListObjectsV2", mock.Anything).Return(&s3.ListObjectsV2Output{
			Contents: []*s3.Object{
				{Key: aws.String("a_object1"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
				{Key: aws.String("a_object2"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
			}}, nil)

		mockClient.On("GetObjectTagging", mock.Anything).Return(&s3.GetObjectTaggingOutput{}, errors.New("Error getting tags"))
		output, err := ListAllObjectsForProcessing(bucket, utils.ParseTime("2025-04-07T09:49:42Z"))
		fmt.Println(output)

		gomega.Expect(err).ToNot(gomega.BeNil())

	})
})

var _ = ginkgo.Describe("processObject", func() {
	var mockClient *mockS3.MockS3Client
	var bucket *bucketOperations.Bucket
	var errorChan chan error

	ginkgo.BeforeEach(func() {
		mockClient = new(mockS3.MockS3Client)
		bucket = &bucketOperations.Bucket{
			Name:   "test-bucket",
			Client: mockClient,
		}
		errorChan = make(chan error, 1)
	})
	ginkgo.Context("should handle errors at various stages", func() {

		ginkgo.It("should handle AddTag errors", func() {
			mockClient.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, errors.New("could not add tag"))

			processObject("dummy", bucket, bucket, errorChan)

			err := <-errorChan

			gomega.Expect(err).ToNot(gomega.BeNil())
		})

		ginkgo.It("should handle GetObject errors", func() {
			mockClient.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, nil)
			mockClient.On("GetObject", mock.Anything).Return(&s3.GetObjectOutput{}, errors.New("could not get object"))
			mockClient.On("DeleteObjectTagging", mock.Anything).Return(&s3.DeleteObjectTaggingOutput{}, nil)
			processObject("dummy", bucket, bucket, errorChan)

			err := <-errorChan

			gomega.Expect(err).ToNot(gomega.BeNil())

		})
		ginkgo.It("should handle PutObject errors", func() {
			mockClient.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, nil)
			mockClient.On("GetObject", mock.Anything).Return(&s3.GetObjectOutput{}, nil)
			mockClient.On("PutObject", mock.Anything).Return(&s3.PutObjectOutput{}, errors.New("could not put object"))
			mockClient.On("DeleteObjectTagging", mock.Anything).Return(&s3.DeleteObjectTaggingOutput{}, nil)

			processObject("dummy", bucket, bucket, errorChan)

			err := <-errorChan

			gomega.Expect(err).ToNot(gomega.BeNil())

		})
		ginkgo.It("should handle DeleteTag errors", func() {
			mockClient.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, nil)
			mockClient.On("GetObject", mock.Anything).Return(&s3.GetObjectOutput{}, nil)
			mockClient.On("PutObject", mock.Anything).Return(&s3.PutObjectOutput{}, nil)

			mockClient.On("DeleteObjectTagging", mock.Anything).Return(&s3.DeleteObjectTaggingOutput{}, errors.New("could not delete tag"))

			processObject("dummy", bucket, bucket, errorChan)

			err := <-errorChan

			gomega.Expect(err).ToNot(gomega.BeNil())

		})
	})

	ginkgo.Context("should process successfully", func() {
		ginkgo.It("should handle have no errors", func() {
			mockClient.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, nil)

			mockClient.On("GetObject", mock.Anything).Return(&s3.GetObjectOutput{
				Body: io.NopCloser(bytes.NewReader([]byte("Hello, World!"))),
			}, nil)

			mockClient.On("PutObject", mock.Anything).Return(&s3.PutObjectOutput{}, nil)

			mockClient.On("DeleteObjectTagging", mock.Anything).Return(&s3.DeleteObjectTaggingOutput{}, nil)

			processObject("dummy", bucket, bucket, errorChan)

			err := <-errorChan

			gomega.Expect(err).To(gomega.BeNil())
		})
	})
})

var _ = ginkgo.Describe("StartProcessing", func() {
	var mockClient *mockS3.MockS3Client
	var bucket *bucketOperations.Bucket

	ginkgo.BeforeEach(func() {
		mockClient = new(mockS3.MockS3Client)
		bucket = &bucketOperations.Bucket{
			Name:   "test-bucket",
			Client: mockClient,
		}
	})
	ginkgo.It("should have no errors", func() {
		mockClient.On("GetObject", mock.Anything).Return(&s3.GetObjectOutput{
			Body: aws.ReadSeekCloser(strings.NewReader(`{"timestamp":"2025-02-07T09:49:42Z"}`)),
		}, nil)

		mockClient.On("ListObjectsV2", mock.Anything).Return(&s3.ListObjectsV2Output{
			Contents: []*s3.Object{
				{Key: aws.String("a_object1"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
				{Key: aws.String("b_object2"), LastModified: utils.TimePointer(utils.ParseTime("2025-03-07T09:49:42Z"))},
			},
		}, nil)

		mockClient.On("GetObjectTagging", mock.Anything).Return(&s3.GetObjectTaggingOutput{}, nil)

		mockClient.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, nil)

		mockClient.On("GetObject", mock.Anything).Return(&s3.GetObjectOutput{
			Body: io.NopCloser(bytes.NewReader([]byte("Hello, World!"))),
		}, nil)

		mockClient.On("PutObject", mock.Anything).Return(&s3.PutObjectOutput{}, nil)

		mockClient.On("DeleteObjectTagging", mock.Anything).Return(&s3.DeleteObjectTaggingOutput{}, nil)

		err := StartProcessing(bucket, bucket)

		gomega.Expect(err).To(gomega.BeNil())
	})
})
