package main

import (
	"fmt"
	"log"
	"os"
	"strings"
)

// This is a dummy testfile generator and has nothing to do with actual working of the code.
// It is for testing purpose
func generateScript() {
	n := 2000
	for i := range n {

		c := rune(i%26) + 'a'
		filename := fmt.Sprintf("%ctest%d.txt", c, i)

		tempFile, err := os.Create(fmt.Sprintf("testFiles/%s", filename))

		if err != nil {
			log.Fatal(err)
		}

		var sb strings.Builder
		for i := range 1 {
			sb.WriteString(fmt.Sprintf("This is file %d which is going to be processed. Capitalize it !\n", i))
		}
		// Read from response body
		_, _ = tempFile.WriteString(sb.String())

	}
}

func main() {
	generateScript()
}
