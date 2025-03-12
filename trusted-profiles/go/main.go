package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/IBM/go-sdk-core/v5/core"
)

type content struct {
	Key string `xml:"Key"`
}

type listBucketResult struct {
	Contents []content `xml:"Contents"`
}

func main() {
	// read environment variables
	cosBucket := os.Getenv("COS_BUCKET")
	if cosBucket == "" {
		log.Panic("environment variable COS_BUCKET is not set")
	}
	cosRegion := os.Getenv("COS_REGION")
	if cosRegion == "" {
		log.Panic("environment variable COS_REGION is not set")
	}
	trustedProfileName := os.Getenv("TRUSTED_PROFILE_NAME")
	if trustedProfileName == "" {
		log.Panic("environment variable TRUSTED_PROFILE_NAME is not set")
	}

	// create an authenticator based on a trusted profile
	authenticator := core.NewContainerAuthenticatorBuilder().SetIAMProfileName(trustedProfileName)

	// prepare the request to list the files in the bucket
	request, err := http.NewRequest(http.MethodGet, fmt.Sprintf("https://s3.direct.%s.cloud-object-storage.appdomain.cloud/%s", cosRegion, cosBucket), nil)
	if err != nil {
		log.Panicf("Failed to create request: %v", err)
	}

	// authenticate the request
	if err = authenticator.Authenticate(request); err != nil {
		log.Panicf("Failed to authenticate request: %v", err)
	}

	// perform the request
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		log.Panicf("Failed to perform request: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		log.Panicf("Unexpected status code: %d", response.StatusCode)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		log.Panicf("Failed to read response body: %v", err)
	}

	// parse the response which is in XML format
	listBucketResult := &listBucketResult{}
	if err = xml.Unmarshal(body, listBucketResult); err != nil {
		log.Panicf("Failed to parse response body: %v", err)
	}

	// print the details
	log.Printf("Found %d objects:", len(listBucketResult.Contents))
	for _, item := range listBucketResult.Contents {
		log.Printf("- %s", item.Key)
	}
}
