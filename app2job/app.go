package main

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"math/rand"
	"net/http"
	"strings"
)

var Token = ""
var NS = "" // Namespace
var CertPool = (*x509.CertPool)(nil)
var Kube = "https://kubernetes.default.svc:443"
var KubeURL = Kube + "/apis/codeengine.cloud.ibm.com/v1beta1/namespaces/"

// Look at the predefined files in the Application's filesystem for
// creds and certs for how to talk to Kubernetes
func prep() {
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

// Handle incoming requests. Job definition name will be in the path
func Handler(w http.ResponseWriter, r *http.Request) {
	jobDef := strings.Trim(r.URL.Path, "/")

	if len(jobDef) == 0 {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, "Bad path: %s - should be 'jobdef'\n", r.URL.Path)
		return
	}

	// Only submit a Job on a PUT or POST
	if r.Method == "PUT" || r.Method == "POST" {
		// Give the Job submission a random name
		name := fmt.Sprintf("%s-%d", jobDef, rand.Int())

		// JSON for the new Job submission
		reader := bytes.NewReader([]byte(`{
          "apiVersion": "codeengine.cloud.ibm.com/v1beta1",
          "kind": "JobRun",
          "metadata": {
            "name": "` + name + `",
            "namespace": "` + NS + `"
          },
          "spec": {
            "jobDefinitionRef": "` + jobDef + `"
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
			fmt.Fprintf(w, "Error: %s\n", err)
			return
		}
		defer res.Body.Close()
		body, err := ioutil.ReadAll(res.Body)
		if err != nil || len(body) == 0 {
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, "%s\n", res.Status)
			return
		}

		// Something went wrong
		if res.StatusCode != 201 {
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, "%s: %s\n", res.Status, string(body))
		} else {
			w.WriteHeader(http.StatusCreated)
			fmt.Fprintf(w, "%s\n", name)
		}
	}
}

func main() {
	prep()
	http.HandleFunc("/", Handler)
	fmt.Print("Listening on port 8080\n")
	http.ListenAndServe(":8080", nil)
}
