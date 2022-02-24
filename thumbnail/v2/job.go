package main

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"log"
	"os"
	"strings"

	cosclient "github.com/duglin/cosclient/client"
	"github.com/nfnt/resize"
)

func MakeThumbnail(inBuf []byte) ([]byte, error) {
	inPicture, _, err := image.Decode(bytes.NewReader(inBuf))
	if err != nil {
		return nil, fmt.Errorf("Error decoding picture: %s", err)
	}

	buf := &bytes.Buffer{}
	// resize to width using Lanczos resampling
	// and preserve aspect ratio
	thumb := resize.Resize(50, 50, inPicture, resize.Lanczos3)
	err = png.Encode(buf, thumb)
	if err != nil {
		return nil, fmt.Errorf("Error shrinking picture: %s", err)
	}

	return buf.Bytes(), nil
}

func CalcThumbnails(bucketName string) error {
	apiKey := os.Getenv("CLOUD_OBJECT_STORAGE_APIKEY")
	svcID := os.Getenv("CLOUD_OBJECT_STORAGE_RESOURCE_INSTANCE_ID")

	COSClient, err := cosclient.NewClient(apiKey, svcID)
	if err != nil {
		return err
	}

	objs, err := COSClient.ListObjects(bucketName)
	if err != nil {
		return err
	}

	names := []string{}
	thumbs := map[string]bool{}

	for _, obj := range objs {
		if strings.HasSuffix(obj.Key, "-thumb") {
			thumbs[obj.Key] = true
			continue
		}
		names = append(names, obj.Key)
	}

	for _, name := range names {
		if _, ok := thumbs[name+"-thumb"]; !ok {
			log.Printf("Processing: %s", name)
			picture, err := COSClient.DownloadObject(bucketName, name)
			if err != nil {
				return fmt.Errorf("Error downloading %q: %s", name, err)
			}

			thumb, err := MakeThumbnail(picture)
			if err == nil {
				err = COSClient.UploadObject(bucketName, name+"-thumb", thumb)
				if err != nil {
					return fmt.Errorf("Error uploading %q:%s", name+"-thumb",
						err)
				} else {
					log.Printf("Added: %s", name+"-thumb")
				}
			} else {
				return fmt.Errorf("Error processing %q: %s", name, err)
			}
		}
	}
	return nil
}

func main() {

	bucketName := os.Getenv("BUCKET")
	if bucketName == "" {
		bucketName = "ce-pictures"
	}

	if err := CalcThumbnails(bucketName); err != nil {
		fmt.Fprintf(os.Stderr, "Error calculating thumbnails: %s\n", err)
		os.Exit(1)
	}
}
