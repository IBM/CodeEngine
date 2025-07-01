package bucketOperations

import (
	"errors"
	"testing"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
	"github.com/stretchr/testify/mock"
	. "ibm.com/codeengine/cos2cos/mock"
)

func TestBucketOps(t *testing.T) {
	gomega.RegisterFailHandler(ginkgo.Fail)
	ginkgo.RunSpecs(t, "BucketOperations Suite")
}

var _ = ginkgo.Describe("ListBucketObjects", func() {

	var (
		mockClient *MockS3Client
		bucket     *Bucket
	)

	// Setup before each test
	ginkgo.BeforeEach(func() {
		mockClient = new(MockS3Client)
		bucket = &Bucket{
			Name:   "test-bucket",
			Client: mockClient, // Inject mock client for testing
		}
	})

	// Define test cases
	testCases := []struct {
		description   string
		mockResponse  *s3.ListObjectsV2Output
		mockError     error
		expectedError bool
		expectedCount int
	}{
		{
			description: "Successful response with objects",
			mockResponse: &s3.ListObjectsV2Output{
				Contents: []*s3.Object{
					{Key: aws.String("file1.txt")},
					{Key: aws.String("file2.txt")},
				},
			},
			mockError:     nil,
			expectedError: false,
			expectedCount: 2,
		},
		{
			description:   "Error response from IBM COS",
			mockResponse:  nil,
			mockError:     errors.New("some IBM COS error"),
			expectedError: true,
			expectedCount: 0,
		},
	}

	// Iterate through the test cases
	for _, tc := range testCases {
		ginkgo.Context(tc.description, func() {
			ginkgo.It("should handle the response correctly", func() {
				// Setup mock expectation
				mockClient.On("ListObjectsV2", mock.AnythingOfType("*s3.ListObjectsV2Input")).Return(tc.mockResponse, tc.mockError)

				// Call the method
				result, err := bucket.ListBucketObjects()

				// Assertions
				if tc.expectedError {
					gomega.Expect(err).To(gomega.HaveOccurred())
					gomega.Expect(result).To(gomega.BeNil())
				} else {
					gomega.Expect(err).ToNot(gomega.HaveOccurred())
					gomega.Expect(result).ToNot(gomega.BeNil())
					gomega.Expect(len(result.Contents)).To(gomega.Equal(tc.expectedCount))
				}

				// Assert mock expectations were met
				mockClient.AssertExpectations(ginkgo.GinkgoT())
			})
		})
	}
})

var _ = ginkgo.Describe("UploadBytesToBucket", func() {
	var mockClient *MockS3Client
	var bucket *Bucket

	ginkgo.BeforeEach(func() {
		mockClient = new(MockS3Client)
		bucket = &Bucket{
			Name:   "Test Bucket",
			Client: mockClient,
		}
	})
	type UploadBytesToBucketTestCase struct {
		ObjectKey     string
		Data          []byte
		MockResponse  *s3.PutObjectOutput
		MockError     error
		ExpectedError error
	}
	testCases := []UploadBytesToBucketTestCase{
		{
			ObjectKey:     "test-object-1",
			Data:          []byte("some data to upload"),
			MockResponse:  &s3.PutObjectOutput{}, // Successful response
			MockError:     nil,
			ExpectedError: nil, // No error expected
		},
		{
			ObjectKey:     "test-object-2",
			Data:          []byte("some data to upload"),
			MockResponse:  nil, // No response
			MockError:     errors.New("failed to upload data"),
			ExpectedError: errors.New("failed to upload data"), // Error expected
		},
	}

	for _, tc := range testCases {
		ginkgo.It("Should handle uploads correctly", func() {
			mockClient.On("PutObject", mock.Anything).Return(tc.MockResponse, tc.MockError)

			err := bucket.UploadBytesToBucket(tc.ObjectKey, tc.Data)

			if tc.ExpectedError == nil {
				gomega.Expect(err).NotTo(gomega.HaveOccurred())
			} else {
				gomega.Expect(err).To(gomega.HaveOccurred())
			}
			mockClient.AssertExpectations(ginkgo.GinkgoT())
		})
	}
})
