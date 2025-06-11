package userDefinedProcess

import (
	"fmt"
	"strings"

	"github.com/IBM/ibm-cos-sdk-go/service/s3"
)

// Sample function. To be modified as per use.
func UserDefinedProcessObject(object *s3.GetObjectOutput) *s3.GetObjectOutput {
	fmt.Println(object)
	return object
}

func UserDefinedProcessObjectBytes(objectBytes []byte) ([]byte, error) {
	return []byte(strings.ToUpper(string(objectBytes))), nil
}
