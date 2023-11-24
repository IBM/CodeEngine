package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Printf("Hi from a batch job! My index is: %s, custom JOB_ARRAY_SIZE value is: %s\n", os.Getenv("JOB_INDEX"), os.Getenv("JOB_ARRAY_SIZE"))
}
