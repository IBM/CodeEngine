package utils_test

import (
	"bytes"
	"fmt"
	"io"
	"testing"

	"github.com/IBM/ibm-cos-sdk-go/service/s3"
	"github.com/onsi/ginkgo/v2"
	"github.com/onsi/gomega"
	"ibm.com/codeengine/cos2cos/utils"
)

func TestUtils(t *testing.T) {
	gomega.RegisterFailHandler(ginkgo.Fail)
	ginkgo.RunSpecs(t, "Utils Suite")
}

var _ = ginkgo.Describe("ConvertObjectToByte", func() {

	// Define test cases as a slice of structs
	testCases := []struct {
		name        string
		input       *s3.GetObjectOutput
		expected    []byte
		expectedErr bool
	}{
		{
			name: "When the input is valid",
			input: &s3.GetObjectOutput{
				Body: io.NopCloser(bytes.NewReader([]byte("Hello, World!"))),
			},
			expected:    []byte("Hello, World!"),
			expectedErr: false,
		},
		{
			name: "When the Body is nil",
			input: &s3.GetObjectOutput{
				Body: nil,
			},
			expected:    nil,
			expectedErr: true,
		},
		{
			name:        "When the input is nil",
			input:       nil,
			expected:    nil,
			expectedErr: true,
		},
	}

	// Loop through test cases and run each one
	for _, tc := range testCases {

		ginkgo.Context(tc.name, func() {
			ginkgo.It(fmt.Sprintf("should behave as expected for %s", tc.name), func() {
				// Call the ConvertObjectToByte function
				result, err := utils.ConvertObjectToByte(tc.input)

				// Assert that the error behavior matches the expected behavior
				if tc.expectedErr {
					gomega.Expect(err).To(gomega.HaveOccurred())
				} else {
					gomega.Expect(err).To(gomega.BeNil())
				}

				// Assert that the result matches the expected byte slice
				gomega.Expect(result).To(gomega.Equal(tc.expected))
			})
		})
	}
})
