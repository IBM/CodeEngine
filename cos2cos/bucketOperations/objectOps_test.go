package bucketOperations

import (
	"errors"
	"strings"
	"time"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
	"github.com/stretchr/testify/mock"
	mockS3 "ibm.com/codeengine/cos2cos/mock"
)

// func TestObjectOps(t *testing.T) {
// 	gomega.RegisterFailHandler(ginkgo.Fail)
// 	ginkgo.RunSpecs(t, "ObjectOperations Suite")
// }

var _ = ginkgo.Describe("CompareUpdateTime", func() {
	type testCase struct {
		name            string
		lastProcessTime time.Time
		obj             *s3.Object
		expected        int
	}

	testCases := []testCase{
		{
			name:            "Zero Valued Time - When No previous processing",
			lastProcessTime: time.Time{},
			obj: &s3.Object{
				Key:          aws.String("TestObject"),
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 10, 0, 0, 0, time.UTC); return &t }(),
			},
			expected: 1,
		},
		{
			name:            "Object Time greater than lastProcessedTime",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 0, 0, time.UTC),
			obj: &s3.Object{
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 10, 0, 1, 1, time.UTC); return &t }(),
			},
			expected: 1,
		},
		{
			name:            "Object Time before than lastProcessedTime",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 0, 0, time.UTC),
			obj: &s3.Object{
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 9, 0, 1, 1, time.UTC); return &t }(),
			},
			expected: -1,
		},
		{
			name:            "Object Time Equal than lastProcessedTime",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 1, 0, time.UTC),
			obj: &s3.Object{
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 10, 0, 1, 0, time.UTC); return &t }(),
			},
			expected: 0,
		},
		{
			name:            "Null Object",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 1, 0, time.UTC),
			obj:             nil,
			expected:        -1,
		},
	}

	for _, testcase := range testCases {
		ginkgo.It(testcase.name, func() {
			result := CompareUpdateTime(testcase.obj, testcase.lastProcessTime)
			// fmt.Println(result)
			gomega.Expect(result).To(gomega.Equal(testcase.expected))
		})
	}
})

var _ = ginkgo.Describe("IsProcessingRequired", func() {
	type testCase struct {
		name            string
		lastProcessTime time.Time
		obj             *s3.Object
		expected        bool
	}

	testCases := []testCase{
		{
			name:            "Zero Valued Time - When No previous processing",
			lastProcessTime: time.Time{},
			obj: &s3.Object{
				Key:          aws.String("TestObject"),
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 10, 0, 0, 0, time.UTC); return &t }(),
			},
			expected: true,
		},
		{
			name:            "Object Time greater than lastProcessedTime",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 0, 0, time.UTC),
			obj: &s3.Object{
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 10, 0, 1, 1, time.UTC); return &t }(),
			},
			expected: true,
		},
		{
			name:            "Object Time before than lastProcessedTime",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 0, 0, time.UTC),
			obj: &s3.Object{
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 9, 0, 1, 1, time.UTC); return &t }(),
			},
			expected: false,
		},
		{
			name:            "Object Time Equal than lastProcessedTime",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 1, 0, time.UTC),
			obj: &s3.Object{
				LastModified: func() *time.Time { t := time.Date(2025, 3, 12, 10, 0, 1, 0, time.UTC); return &t }(),
			},
			expected: false,
		},
		{
			name:            "Null Object",
			lastProcessTime: time.Date(2025, 3, 12, 10, 0, 1, 0, time.UTC),
			obj:             nil,
			expected:        false,
		},
	}

	for _, testcase := range testCases {
		ginkgo.It(testcase.name, func() {
			result := IsProcessingRequired(testcase.obj, testcase.lastProcessTime)
			gomega.Expect(result).To(gomega.Equal(testcase.expected))
		})
	}
})

var _ = ginkgo.Describe("CheckIfTagExists", func() {
	var (
		mockS3Client *mockS3.MockS3Client
		bucket       *Bucket
	)

	// Initialize before each test
	ginkgo.BeforeEach(func() {
		mockS3Client = new(mockS3.MockS3Client)
		bucket = &Bucket{
			Client: mockS3Client,
			Name:   "test-bucket",
		}
	})
	// Struct to represent a test case for CheckIfTagExists
	type CheckIfTagExistsTestCase struct {
		ObjectKey      string
		TagKey         string
		MockResponse   *s3.GetObjectTaggingOutput
		MockError      error
		ExpectedResult bool
	}
	// Test cases in a struct array
	testCases := []CheckIfTagExistsTestCase{
		{
			ObjectKey: "test-object-1",
			MockResponse: &s3.GetObjectTaggingOutput{
				TagSet: []*s3.Tag{
					{Key: aws.String("isInProcessing"), Value: aws.String("value1")},
					{Key: aws.String("Tag2"), Value: aws.String("value2")},
				},
			},
			MockError:      nil,
			ExpectedResult: true,
		},
		{
			ObjectKey: "test-object-2",
			MockResponse: &s3.GetObjectTaggingOutput{
				TagSet: []*s3.Tag{
					{Key: aws.String("Tag1"), Value: aws.String("value1")},
					{Key: aws.String("Tag2"), Value: aws.String("value2")},
				},
			},
			MockError:      nil,
			ExpectedResult: false,
		},
		{
			ObjectKey:      "test-object-3",
			MockResponse:   nil,
			MockError:      errors.New("failed to get tags"),
			ExpectedResult: false,
		},
	}

	// Iterate over the test cases
	for _, tc := range testCases {
		ginkgo.It("should correctly check if the tag exists", func() {
			// Mock the GetObjectTagging behavior
			mockS3Client.On("GetObjectTagging", mock.Anything).Return(tc.MockResponse, tc.MockError)

			// Call the method
			result, _ := bucket.CheckIfTagExists(tc.ObjectKey)

			// Assertions
			gomega.Expect(result).To(gomega.Equal(tc.ExpectedResult))

			// Assert that the GetObjectTagging method was called with the correct input
			mockS3Client.AssertExpectations(ginkgo.GinkgoT())
		})
	}
})

var _ = ginkgo.Describe("GetObject", func() {
	var (
		mockS3Client *mockS3.MockS3Client
		bucket       *Bucket
	)

	ginkgo.BeforeEach(func() {
		mockS3Client = new(mockS3.MockS3Client)
		bucket = &Bucket{
			Name:   "test-bucket",
			Client: mockS3Client,
		}
	})

	var testCases = []struct {
		ObjectKey     string
		MockResponse  *s3.GetObjectOutput
		MockError     error
		ExpectedError bool
	}{
		{
			ObjectKey: "test-object-key",
			MockResponse: &s3.GetObjectOutput{
				Body: aws.ReadSeekCloser(strings.NewReader("object content")),
			},
			MockError:     nil,
			ExpectedError: false,
		},
		{
			ObjectKey:     "non-existent-object",
			MockResponse:  nil,
			MockError:     errors.New("no such key"),
			ExpectedError: true,
		},
	}

	for _, tc := range testCases {
		tc := tc
		ginkgo.It("should return correct result for object key: "+tc.ObjectKey, func() {
			// Setup mock response
			mockS3Client.On("GetObject", mock.Anything).Return(tc.MockResponse, tc.MockError)

			// Call the method
			object, err := bucket.GetObject(tc.ObjectKey)

			// Verify the result
			if tc.ExpectedError {
				gomega.Expect(err).To(gomega.MatchError(tc.MockError))
				gomega.Expect(object).To(gomega.BeNil())
			} else {
				gomega.Expect(err).To(gomega.BeNil())
				gomega.Expect(object).NotTo(gomega.BeNil())
				gomega.Expect(object.Body).NotTo(gomega.BeNil())
			}

			// Assert mock expectations
			mockS3Client.AssertExpectations(ginkgo.GinkgoT())
		})
	}
})

var _ = ginkgo.Describe("AddTag", func() {
	var (
		mockS3Client *mockS3.MockS3Client
		bucket       *Bucket
	)

	ginkgo.BeforeEach(func() {
		mockS3Client = new(mockS3.MockS3Client)
		bucket = &Bucket{
			Name:   "test-bucket",
			Client: mockS3Client,
		}
	})

	ginkgo.It("should have no errors", func() {
		mockS3Client.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, nil)
		err := bucket.AddTag("ObjecttKey1", "tagKey1", "value")

		gomega.Expect(err).To(gomega.BeNil())
	})
	ginkgo.It("should have handle errors", func() {
		mockS3Client.On("PutObjectTagging", mock.Anything).Return(&s3.PutObjectTaggingOutput{}, errors.New("error adding tag"))
		err := bucket.AddTag("ObjecttKey1", "tagKey1", "value")

		gomega.Expect(err).ToNot(gomega.BeNil())
	})
})

var _ = ginkgo.Describe("DeleteTag", func() {
	var (
		mockS3Client *mockS3.MockS3Client
		bucket       *Bucket
	)

	ginkgo.BeforeEach(func() {
		mockS3Client = new(mockS3.MockS3Client)
		bucket = &Bucket{
			Name:   "test-bucket",
			Client: mockS3Client,
		}
	})

	ginkgo.It("should delete tag and have no errors", func() {
		mockS3Client.On("DeleteObjectTagging", mock.Anything).Return(&s3.DeleteObjectTaggingOutput{}, nil)
		err := bucket.DeleteTag("ObjecttKey1", "tagKey1")

		gomega.Expect(err).To(gomega.BeNil())
	})
	ginkgo.It("should have handle errors", func() {
		mockS3Client.On("DeleteObjectTagging", mock.Anything).Return(&s3.DeleteObjectTaggingOutput{}, errors.New("error delete tag"))
		err := bucket.DeleteTag("ObjecttKey1", "tagKey1")

		gomega.Expect(err).ToNot(gomega.BeNil())
	})
})
