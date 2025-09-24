package utils

import (
	"fmt"
	"io"
	"time"

	"github.com/IBM/ibm-cos-sdk-go/service/s3"
)

func ConvertObjectToByte(result *s3.GetObjectOutput) ([]byte, error) {
	if result == nil || result.Body == nil {
		return nil, fmt.Errorf("invalid GetObjectOutput or Body is nil")
	}
	data, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read object data: %w", err)
	}

	return data, nil
}

func ParseTime(timeString string) time.Time {
	res, _ := (time.Parse(time.RFC3339, timeString))
	return res
}
func TimePointer(t time.Time) *time.Time {
	return &t
}
