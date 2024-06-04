/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

package cos

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"strings"

	"encoding/json"

	"observer/configuration"
	"observer/observerrequests"

	"github.com/IBM/ibm-cos-sdk-go/aws"
	"github.com/IBM/ibm-cos-sdk-go/aws/credentials/ibmiam"
	"github.com/IBM/ibm-cos-sdk-go/aws/session"
	"github.com/IBM/ibm-cos-sdk-go/service/s3"
)

type CosStore struct {
	initialised bool
	config      configuration.Config
	client      *s3.S3
}

func (c *CosStore) initialise() {
	slog.Info("CosStore: Initialising cos connection")
	c.config.LoadCosStorageConfig()

	conf := aws.NewConfig().
		WithEndpoint(c.config.CosEndpoint()).
		WithCredentials(ibmiam.NewStaticCredentials(aws.NewConfig(),
			c.config.CosAuthEndpoint(),
			c.config.CosAPIKey(),
			c.config.CosInstanceId())).
		WithS3ForcePathStyle(true)

	sess := session.Must(session.NewSession())

	c.client = s3.New(sess, conf)

	if !c.checkForBucket() && !c.createBucket() {
		slog.Warn("CosStore: bucket not found and unable to create it")
		c.initialised = false
	} else {
		slog.Info("CosStore: Connection to bucket established")
		c.initialised = true
	}
}

func (c *CosStore) createBucket() bool {
	input := &s3.CreateBucketInput{
		Bucket: aws.String(c.config.CosBucket()),
	}
	c.client.CreateBucket(input)
	if !c.checkForBucket() {
		slog.Warn("CosStore: Bucket create failed")
		return false
	}
	return true
}

func (c CosStore) checkForBucket() bool {
	var haveFoundBucket bool

	if nil == c.client {
		slog.Warn("CosStore: No COS connection, aborting bucket check")
		return haveFoundBucket
	}

	if bucketData, err := c.client.ListBuckets(&s3.ListBucketsInput{}); nil != err {
		slog.Warn("CosStore: Error obtaining list of COS Buckets", "error", err)
	} else {
		// slog.Info("CosStore: ", "raw bucket data", bucketData)
		// buckets := bucketData.Buckets
		// slog.Info("CosStore: ", "buckets", buckets)

		for _, bucket := range bucketData.Buckets {
			slog.Info("CosStore: ", "bucket name", *bucket.Name)
			if 0 == strings.Compare(*bucket.Name, c.config.CosBucket()) {
				// slog.Info("CosStore: ", "bucket details", bucket)
				haveFoundBucket = true
				break
			}
		}
	}

	if haveFoundBucket {
		slog.Info("CosStore: Bucket Exists")
	}

	return haveFoundBucket
}

func (c *CosStore) Save(requests *observerrequests.ObserverRequests) (bool, error) {
	slog.Info("CosStore: Save process starting")
	changes := false
	if !c.initialised {
		c.initialise()
	}
	if !c.initialised {
		slog.Warn("CosStore: aborting save to storage")
		return changes, fmt.Errorf("CosStore failed to initialise connection to bucket")
	}

	if oldRequests, err := c.Load(); nil != err {
		slog.Info("CosStore: No existing store, can create new")
	} else {
		changes = requests.CheckDates(oldRequests)
	}

	requests.SetLastUpdated()

	if data, err := json.Marshal(requests); nil != err {
		slog.Warn("CosStore: Unable to marshal data")
		return changes, err
	} else {
		//slog.Info("CosStore: Data marshalled into bytes", "data", data)

		input := s3.PutObjectInput{
			Bucket: aws.String(c.config.CosBucket()),
			Key:    aws.String(c.config.CosDataKey()),
			Body:   bytes.NewReader(data),
		}

		result, _ := c.client.PutObject(&input)
		fmt.Println(result)
	}

	return changes, nil
}

func (c *CosStore) Load() (*observerrequests.ObserverRequests, error) {
	slog.Info("CosStore: Load process starting")
	if !c.initialised {
		c.initialise()
	}
	if !c.initialised {
		slog.Warn("CosStore: aborting load from storage")
		return nil, fmt.Errorf("CosStore unable to initialise connection to bucket")
	}

	Input := s3.GetObjectInput{
		Bucket: aws.String(c.config.CosBucket()),
		Key:    aws.String(c.config.CosDataKey()),
	}

	if res, err := c.client.GetObject(&Input); nil != err {
		slog.Warn("CosStore: get object", "error", err)
		return nil, err
	} else if body, err := io.ReadAll(res.Body); nil != err {
		slog.Warn("CosStore: read error", "error", err)
		return nil, err
	} else {
		slog.Info("CosStore: stored data retrieved")
		var requests observerrequests.ObserverRequests
		if err = json.Unmarshal(body, &requests); nil != err {
			slog.Warn("CosStore: data unmarshalling", "error", err)
			return nil, err
		}
		//slog.Info("CosStore: retrieved", "data", requests)
		return &requests, nil
	}
}
