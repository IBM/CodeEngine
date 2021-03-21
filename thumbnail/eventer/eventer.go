package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"

	cosclient "github.com/duglin/cosclient/client"
	"github.com/nfnt/resize"
)

var apiKey = ""
var authURL = ""
var svcURL = ""
var svcID = ""
var COSClient = (*cosclient.COSClient)(nil)

func MakeThumbnail(inBuf []byte) ([]byte, error) {
	inImage, _, err := image.Decode(bytes.NewReader(inBuf))
	if err != nil {
		return nil, fmt.Errorf("Error decoding image: %s", err)
	}

	buf := &bytes.Buffer{}
	// resize to width using Lanczos resampling
	// and preserve aspect ratio
	thumb := resize.Resize(50, 50, inImage, resize.Lanczos3)
	err = png.Encode(buf, thumb)
	if err != nil {
		return nil, fmt.Errorf("Error shrinking image: %s", err)
	}

	return buf.Bytes(), nil
}

func CalcThumbnail(bucketName string, objectName string) error {
	log.Printf("Processing: %s", objectName)
	image, err := COSClient.DownloadObject(bucketName, objectName)
	if err != nil {
		return fmt.Errorf("Error downloading %q: %s", objectName, err)
	}

	thumb, err := MakeThumbnail(image)
	if err == nil {
		err = COSClient.UploadObject(bucketName, objectName+"-thumb", thumb)
		if err != nil {
			return fmt.Errorf("Error uploading %q:%s", objectName+"-thumb",
				err)
		} else {
			log.Printf("Added: %s", objectName+"-thumb")
		}
	} else {
		return fmt.Errorf("Error processing %q: %s", objectName, err)
	}
	return nil
}

func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	type EventNotification struct {
		BucketName   string `json:"bucket_name"`
		EventType    string `json:"event_type"`
		Format       string `json:"format"`
		ObjectETag   string `json:"object_etag"`
		ObjectLength string `json:"object_length"`
		ObjectName   string `json:"object_name"`
		RequestID    string `json:"request_id"`
		RequestTime  string `json:"request_time"`
	}

	type COSEvent struct {
		Bucket       string            `json:"bucket"`
		Endpoint     string            `json:"endpoint,omitempty"`
		Key          string            `json:"key"`
		Notification EventNotification `json:"notification"`
		Operation    string            `json:"operation"`
	}

	body, _ := ioutil.ReadAll(r.Body)
	var event COSEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Error reading event: %s", err)
		return
	}
	log.Print("Got an event: %s", string(body))

	bucketName := event.Bucket
	objectName := event.Notification.ObjectName

	if event.Operation == "Object:Write" {
		log.Printf("%s/%s was uploaded", bucketName, objectName)

		// Skip all objects that end with "-thumb" since those are thumbnails
		if !strings.HasSuffix(objectName, "-thumb") {
			// Make the thumbnail - log any error
			err := CalcThumbnail(bucketName, objectName)
			if err != nil {
				log.Printf("Error making thumbnail for %s/%s: %s",
					bucketName, objectName, err)
			}
		}
	} else {
		log.Printf("%s/%s was deleted", bucketName, objectName)
	}
}

func main() {
	var err error
	apiKey = os.Getenv("CLOUD_OBJECT_STORAGE_APIKEY")
	svcID = os.Getenv("CLOUD_OBJECT_STORAGE_RESOURCE_INSTANCE_ID")

	COSClient, err = cosclient.NewClient(apiKey, svcID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error setting up COS: %s\n", err)
		// panic(err)
		// Just keep going
	}

	// Register our HTTP handler
	http.HandleFunc("/", HandleHTTP)
	log.Println("Eventer listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
