package metadata_test

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
	"github.com/onsi/ginkgo"
	"github.com/onsi/gomega"
	"github.com/stretchr/testify/mock"
	"ibm.com/codeengine/cos2cos/bucketOperations"
	"ibm.com/codeengine/cos2cos/metadata"
	mockS3 "ibm.com/codeengine/cos2cos/mock"
)

func TestMetadata(t *testing.T) {
	gomega.RegisterFailHandler(ginkgo.Fail)
	ginkgo.RunSpecs(t, "Metadata Suite")
}

var _ = ginkgo.Describe("LoadTimestamp", func() {

	var (
		mockS3Client *mockS3.MockS3Client
		bucket       *bucketOperations.Bucket
	)
	ginkgo.BeforeEach(func() {
		mockS3Client = new(mockS3.MockS3Client)
		bucket = &bucketOperations.Bucket{
			Name:   "test-bucket",
			Client: mockS3Client,
		}
	})
	type LoadTimestampTestCase struct {
		MockGetObjectResponse *s3.GetObjectOutput
		MockGetObjectError    error
		MockReadFileResponse  []byte
		MockReadFileError     error
		ExpectedResult        []byte
		ExpectedError         error
	}
	// Test cases
	var testCases = []LoadTimestampTestCase{
		{
			MockGetObjectResponse: &s3.GetObjectOutput{
				Body: aws.ReadSeekCloser(strings.NewReader("mocked-content")),
			},
			MockGetObjectError:   nil,
			MockReadFileResponse: nil,
			MockReadFileError:    nil,
			ExpectedResult:       []byte("mocked-content"),
			ExpectedError:        nil,
		},
		{
			MockGetObjectResponse: &s3.GetObjectOutput{
				Body: aws.ReadSeekCloser(strings.NewReader("mocked-byte-data")),
			},
			MockGetObjectError:   nil,
			MockReadFileResponse: nil,
			MockReadFileError:    nil,
			ExpectedResult:       []byte("mocked-byte-data"),
			ExpectedError:        nil,
		},
		{

			MockGetObjectResponse: nil,
			MockGetObjectError:    errors.New("failed to get object"),
			MockReadFileResponse:  nil,
			MockReadFileError:     nil,
			ExpectedResult:        nil,
			ExpectedError:         errors.New("failed to get object"),
		},
	}

	// Running the test cases
	for _, tc := range testCases {
		tc := tc
		ginkgo.It("should handle the loadTimestamp correctly", func() {
			// Mocking GetObject for the bucket

			mockS3Client.On("GetObject", mock.Anything).Return(tc.MockGetObjectResponse, tc.MockGetObjectError)

			// Calling the loadTimestamp function
			data, err := metadata.LoadTimestamp([]*bucketOperations.Bucket{bucket})

			// Asserting the result
			gomega.Expect(data).To(gomega.Equal(tc.ExpectedResult))
			if tc.ExpectedError != nil {
				gomega.Expect(err).To(gomega.MatchError(tc.ExpectedError))
			} else {
				gomega.Expect(err).To(gomega.BeNil())
			}

			// Assert mock expectations

			mockS3Client.AssertExpectations(ginkgo.GinkgoT())
		})
	}
})

var _ = ginkgo.Describe("GetLastProcessTime", func() {

	var (
		mockS3Client *mockS3.MockS3Client
		bucket       *bucketOperations.Bucket
	)
	ginkgo.BeforeEach(func() {
		mockS3Client = new(mockS3.MockS3Client)
		bucket = &bucketOperations.Bucket{
			Name:   "test-bucket",
			Client: mockS3Client,
		}
	})
	type GetLastProcessTimeTestCase struct {
		MockGetObjectResponse *s3.GetObjectOutput
		MockGetObjectError    error
		ExpectedResult        time.Time
	}

	// Test cases
	var testCases = []GetLastProcessTimeTestCase{
		{
			MockGetObjectResponse: &s3.GetObjectOutput{
				Body: aws.ReadSeekCloser(strings.NewReader(`{"timestamp":"2025-04-07T09:49:42Z"}`)),
			},
			MockGetObjectError: nil,
			ExpectedResult:     parseTime("2025-04-07T09:49:42Z"),
		},
		{
			MockGetObjectResponse: &s3.GetObjectOutput{
				Body: nil,
			},
			MockGetObjectError: errors.New("No such file found"),
			ExpectedResult:     time.Time{},
		},
	}

	// Running the test cases
	for _, tc := range testCases {
		tc := tc
		ginkgo.It("should handle the GetLastProcessTime correctly", func() {
			// Mocking GetObject for the bucket

			mockS3Client.On("GetObject", mock.Anything).Return(tc.MockGetObjectResponse, tc.MockGetObjectError)

			// Calling the loadTimestamp function
			data := metadata.GetLastProcessTime(bucket)

			// Asserting the result
			gomega.Expect(data).To(gomega.Equal(tc.ExpectedResult))

			// Assert mock expectations

			mockS3Client.AssertExpectations(ginkgo.GinkgoT())
		})
	}
})

func parseTime(timeString string) time.Time {
	res, _ := (time.Parse(time.RFC3339, timeString))
	return res
}

var _ = ginkgo.Describe("PutLastBackupTime", func() {
	var (
		mockS3Client *mockS3.MockS3Client
		bucket       *bucketOperations.Bucket
	)
	ginkgo.BeforeEach(func() {
		mockS3Client = new(mockS3.MockS3Client)
		bucket = &bucketOperations.Bucket{
			Name:   "test-bucket",
			Client: mockS3Client,
		}
	})
	type PutLastProcessTimeTestCase struct {
		InputTimeStamp     string
		MockPutObjectError error
		ExpectedResult     error
	}

	// Test cases
	var testCases = []PutLastProcessTimeTestCase{
		{
			InputTimeStamp:     "2025-04-07T09:49:42Z",
			MockPutObjectError: nil,
			ExpectedResult:     nil,
		},
		{
			InputTimeStamp:     "",
			MockPutObjectError: nil,
			ExpectedResult:     nil,
		},
	}

	for _, tc := range testCases {
		tc := tc
		ginkgo.It("should handle the PutLastProcessTime correctly", func() {
			// Mocking GetObject for the bucket

			mockS3Client.On("PutObject", mock.Anything).Return(&s3.PutObjectOutput{}, tc.MockPutObjectError)

			// Calling the loadTimestamp function
			err := metadata.PutLastBackupTime(tc.InputTimeStamp, bucket)
			fmt.Println(err)
			// Asserting the result
			gomega.Expect(err).To(gomega.BeNil())

			// Assert mock expectations

			mockS3Client.AssertExpectations(ginkgo.GinkgoT())
		})
	}
})
