package main

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	cosclient "github.com/duglin/cosclient/client"
	"github.com/nfnt/resize"
)

var COSClient = (*cosclient.COSClient)(nil)
var BucketName = ""
var JobName = ""
var HideButton = false // Used in the third exercise

// Look at the predefined files in the Application's filesystem for
// creds and certs for how to talk to Kubernetes
var Token = ""
var NS = "" // Namespace
var CertPool = (*x509.CertPool)(nil)
var Kube = "https://kubernetes.default.svc:443"
var KubeURL = Kube + "/apis/codeengine.cloud.ibm.com/v1beta1/namespaces/"

func init() {
	var err error
	var buf []byte

	dir := "/var/run/secrets/kubernetes.io/serviceaccount"

	if buf, err = ioutil.ReadFile(dir + "/token"); err != nil {
		panic(fmt.Sprintf("Can't read token: %s\n", err))
	}
	Token = string(buf)

	if buf, err = ioutil.ReadFile(dir + "/namespace"); err != nil {
		panic(fmt.Sprintf("Can't read namespace: %s\n", err))
	}
	NS = string(buf)

	cert, err := ioutil.ReadFile(dir + "/ca.crt")
	if err != nil {
		panic(fmt.Sprintf("Can't read ca.crt: %s\n", err))
	}
	CertPool = x509.NewCertPool()
	CertPool.AppendCertsFromPEM(cert)
}

func StartJob() error {
	// Give the Job submission a random name
	jobRunName := fmt.Sprintf("%s-%d", JobName, rand.Int())

	// JSON for the new Job submission
	reader := bytes.NewReader([]byte(`{
          "apiVersion": "codeengine.cloud.ibm.com/v1beta1",
          "kind": "JobRun",
          "metadata": {
            "name": "` + jobRunName + `",
            "namespace": "` + NS + `"
          },
          "spec": {
            "jobDefinitionRef": "` + JobName + `"
          }
        }`))

	// Now do the Kubernetes call
	req, _ := http.NewRequest("POST", KubeURL+NS+"/jobruns", reader)
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+Token)

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{RootCAs: CertPool},
		},
	}

	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := ioutil.ReadAll(res.Body)
	if res.StatusCode == 201 {
		return nil
	}

	// Something went wrong
	return fmt.Errorf("Error %s: %s", JobName, res.Status, string(body))
}

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

type COSObjs []cosclient.ObjectMetadata

func (ol COSObjs) Len() int           { return len(ol) }
func (ol COSObjs) Swap(i, j int)      { ol[i], ol[j] = ol[j], ol[i] }
func (ol COSObjs) Less(i, j int) bool { return ol[i].LastModified < ol[j].LastModified }

func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	for strings.HasPrefix(r.URL.Path, "//") {
		r.URL.Path = r.URL.Path[1:]
	}

	switch r.URL.Path {
	case "/":
		if page, err := os.ReadFile("page.html"); err != nil {
			http.Error(w, "Error reading page:"+err.Error(), 503)
		} else {
			buttonDisplay := "inline"
			if HideButton {
				buttonDisplay = "none"
			}
			fmt.Fprintf(w, string(page), buttonDisplay)
		}

	case "/upload":
		if body, err := io.ReadAll(r.Body); err != nil {
			log.Printf("Error reading body:" + err.Error())
			http.Error(w, "Error reading body:"+err.Error(), 503)
		} else if len(body) > 0 {
			err := COSClient.UploadObject(BucketName,
				fmt.Sprintf("image-%d", time.Now().UnixNano()),
				body)
			if err != nil {
				log.Printf("Error uploading: %s", err)
			}
		}

	case "/thumbnail":
		if body, err := io.ReadAll(r.Body); err != nil {
			log.Printf("Error reading body:" + err.Error())
			http.Error(w, "Error reading body:"+err.Error(), 503)
		} else {
			if thumb, err := MakeThumbnail(body); err != nil {
				log.Printf(err.Error())
				http.Error(w, err.Error(), 503)
			} else {
				w.Header().Add("Content-Type", "image/png")
				w.Write(thumb)
			}
		}
	case "/emptybucket":
		COSClient.DeleteBucketContents(BucketName)

	case "/calcthumbnails":
		if HideButton {
			return
		} else {
			err := StartJob()
			if err != nil {
				log.Printf("Error starting job: %s", err)
				http.Error(w, "Error starting job: "+err.Error(), 503)
				return
			}
		}

	case "/bucket":
		objs, err := COSClient.ListObjects(BucketName)
		if err != nil {
			log.Printf("Error getting bucket: %s", err)
			http.Error(w, "Error getting bucket: "+err.Error(), 503)
			return
		}
		sort.Sort(COSObjs(objs))

		names := []string{}
		thumbs := map[string]bool{}

		for _, obj := range objs {
			if strings.HasSuffix(obj.Key, "-thumb") {
				thumbs[obj.Key] = true
				continue
			}
			names = append(names, obj.Key)
		}

		type Item struct {
			Image string
			Thumb string
		}
		list := []Item{}

		for _, name := range names {
			thumb := ""
			if _, ok := thumbs[name+"-thumb"]; ok {
				thumb = "bucket/" + name + "-thumb"
			}
			list = append(list, Item{
				Image: "bucket/" + name,
				Thumb: thumb,
			})
		}
		buf, _ := json.Marshal(list)
		fmt.Fprintln(w, string(buf)) // result)

	default:
		if strings.HasPrefix(r.URL.Path, "/bucket/") {
			name := r.URL.Path[8:]
			obj, err := COSClient.DownloadObject(BucketName, name)
			if err != nil {
				log.Printf("Error downloading %q: %s", name, err)
				w.WriteHeader(404)
				return
			}

			w.Header().Add("Content-Type", "image/png")
			w.Write(obj)
			return
		}

		// Assume it wants a file from disk - like main page
		path := r.URL.Path
		if strings.Index(path, "..") >= 0 {
			http.Error(w, "Bad path: "+path, 404)
			return
		}

		buf, err := os.ReadFile(path[1:]) // strip leading '/'
		if err != nil {
			http.Error(w, "Error reading file:"+err.Error(), 404)
			return
		}
		w.Write(buf)
	}
}

func main() {
	apiKey := os.Getenv("CLOUD_OBJECT_STORAGE_APIKEY")
	svcID := os.Getenv("CLOUD_OBJECT_STORAGE_RESOURCE_INSTANCE_ID")

	var err error

	COSClient, err = cosclient.NewClient(apiKey, svcID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error setting up COS: %s\n", err)
		// panic(err)
		// Just keep going
	}

	if os.Getenv("HIDE_BUTTON") != "" {
		HideButton = true
	}
	BucketName = os.Getenv("BUCKET")
	if BucketName == "" {
		BucketName = "ce-images"
	}

	JobName = os.Getenv("JOB_NAME")
	if JobName == "" {
		JobName = "thumbnail-job"
	}

	// Register the http handler for all requests
	http.HandleFunc("/", HandleHTTP)

	log.Printf("BUCKET: %s\n", BucketName)
	log.Printf("JOB_NAME: %s\n", JobName)
	log.Printf("COS APIKEY: %s\n", apiKey[:5])
	log.Printf("COS SVCID: %s\n", svcID[:5])
	log.Printf("HIDE_BUTTON: %v\n", HideButton)

	log.Println("Listening on port 8080")
	http.ListenAndServe(":8080", nil)
}
