package userDefinedProcess

import (
	"strings"
)

// Sample function. To be modified as per use.
func UserDefinedProcessObjectBytes(objectBytes []byte) ([]byte, error) {
	return []byte(strings.ToUpper(string(objectBytes))), nil
}
