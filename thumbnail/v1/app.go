package main

import (
	"bytes"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"io"
	"net/http"

	// _ "image/png"
	"fmt"
	"image/png"
	"log"
	"os"
	"strings"

	"github.com/nfnt/resize"
)

// https://www.smashingmagazine.com/2018/01/drag-drop-file-uploader-vanilla-js/

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

func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	for strings.HasPrefix(r.URL.Path, "//") {
		r.URL.Path = r.URL.Path[1:]
	}

	log.Printf("Got: %s", r.URL.Path)
	if r.URL.Path == "/" {
		page, err := os.ReadFile("page.html")
		if err != nil {
			http.Error(w, "Error reading page:"+err.Error(), 503)
			return
		}
		w.Write(page)
		return
	}

	if r.URL.Path == "/thumbnail" {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("Error reading body:" + err.Error())
			http.Error(w, "Error reading body:"+err.Error(), 503)
			return
		}
		thumb, err := MakeThumbnail(body)
		if err != nil {
			log.Printf(err.Error())
			http.Error(w, err.Error(), 503)
			return
		}
		w.Header().Add("Content-Type", "image/png")
		w.Write(thumb)
		return
	}

	path := r.URL.Path
	if path[0] == '/' {
		path = path[1:]
	}
	if strings.Index(path, "..") >= 0 {
		http.Error(w, "Bad path: "+path, 404)
		return
	}

	buf, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, "Error reading file:"+err.Error(), 404)
		return
	}
	w.Write(buf)
}

func main() {
	if jobIndex := os.Getenv("JOB_INDEX"); jobIndex != "" {
		// Do batch job
	} else {
		// Debug the http handler for all requests
		http.HandleFunc("/", HandleHTTP)

		log.Println("Listening on port 8080")
		http.ListenAndServe(":8080", nil)
	}
}
