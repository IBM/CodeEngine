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

var _ = ginkgo.Describe("ListAvailableBuckets", func() {
	var (
		mockS3Client *MockS3Client
		bucket       *Bucket
	)

	// Before each test, initialize the mock and the Bucket struct
	ginkgo.BeforeEach(func() {
		mockS3Client = new(MockS3Client)
		bucket = &Bucket{
			Name:   "test-bucket",
			Client: mockS3Client,
		}
	})

	// Test case struct format
	type TestCase struct {
		name           string
		mockResponse   *s3.ListBucketsOutput
		mockError      error
		expectedOutput *s3.ListBucketsOutput
		expectedError  error
	}

	// Define test cases
	var testCases = []TestCase{
		{
			name: "Successful ListBuckets",
			mockResponse: &s3.ListBucketsOutput{
				Buckets: []*s3.Bucket{
					{
						Name: aws.String("bucket1"),
					},
					{
						Name: aws.String("bucket2"),
					},
				},
			},
			mockError: nil,
			expectedOutput: &s3.ListBucketsOutput{
				Buckets: []*s3.Bucket{
					{
						Name: aws.String("bucket1"),
					},
					{
						Name: aws.String("bucket2"),
					},
				},
			},
			expectedError: nil,
		},
		{
			name:           "Error Listing Buckets",
			mockResponse:   nil,
			mockError:      errors.New("failed to list buckets"),
			expectedOutput: nil,
			expectedError:  errors.New("failed to list buckets"),
		},
	}

	// Iterate over test cases
	for _, testCase := range testCases {
		ginkgo.It(testCase.name, func() {
			// Arrange mock behavior
			mockS3Client.On("ListBuckets", mock.Anything).Return(testCase.mockResponse, testCase.mockError)

			// Act
			result, err := bucket.ListAvailableBuckets()

			// Assert the results
			if testCase.expectedError != nil {
				gomega.Expect(err).To(gomega.HaveOccurred())
				gomega.Expect(err.Error()).To(gomega.Equal(testCase.expectedError.Error()))
			} else {
				gomega.Expect(err).ToNot(gomega.HaveOccurred())
				gomega.Expect(result).To(gomega.Equal(testCase.expectedOutput))
			}

			// Assert that the mock was called as expected
			mockS3Client.AssertExpectations(ginkgo.GinkgoT())
		})
	}
})

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
		tc := tc // capture the range variable
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
