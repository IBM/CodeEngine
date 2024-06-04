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

package notifications

import (
	"context"
	"fmt"
	"io"
	"strings"

	"encoding/json"
	"log/slog"
	"net/http"

	"observer/common"
)

type queueChecker struct {
	client *http.Client
}

func (qc queueChecker) runGetDepths(url string, creds common.Credentials) (*queueData, error) {
	slog.Info("QueueChecker: Building GET request")

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodGet,
		url, nil)

	if nil != err {
		return nil, err
	}

	req.Header.Add("ibm-mq-rest-csrf-token", "")
	req.Header.Add("Content-Type", "application/json; charset=utf-8")
	req.SetBasicAuth(creds.User, creds.Pass)

	body, err := qc.run(req)

	if nil != err {
		return nil, err
	}

	qdRaw, err := qc.extractQueueStatus(body)

	if nil != err {
		return nil, err
	}

	return qc.filterQueueStatus(qdRaw), nil
}

func (qc queueChecker) run(req *http.Request) (io.Reader, error) {
	slog.Info("QueueChecker: About to invoke url")
	res, err := qc.client.Do(req)
	if nil != err {
		slog.Warn("QueueChecker: Call was unsuccessful", "error", err)
		return nil, err
	}
	slog.Info("QueueChecker: Call", "status", res.Status)

	if res.StatusCode != http.StatusOK {
		slog.Warn(fmt.Sprintf("QueueChecker: unexpected status: got %v", res.Status))
		return nil, fmt.Errorf("QueueChecker: unexpected status %v", res.Status)
	}

	contentType := res.Header.Get("Content-Type")
	if !strings.Contains(contentType, "json") {
		slog.Warn("QueueChecker: Expected Json, but", "Content-Type", contentType)
		return nil, fmt.Errorf("QueueChecker: Unexpected content type %s", contentType)
	}

	//qc.logBody(res.Body)
	//defer res.Body.Close()

	return res.Body, err
}

func (qc queueChecker) extractQueueStatus(body io.Reader) (*queueData, error) {
	slog.Info("QueueChecker: Parsing Json response")

	var qd queueData

	if nil == body {
		slog.Warn("QueueChecker: Unable to parse as data is empty")
		return nil, fmt.Errorf("QueueChecker: Data body is empty")
	}

	var err error = json.NewDecoder(body).Decode(&qd)
	if nil != err {
		slog.Warn("QueueChecker: error parsing data", "error", err)
	}
	return &qd, err
}

func (qc queueChecker) filterQueueStatus(qdRaw *queueData) *queueData {
	var qdFiltered queueData

	for _, qi := range qdRaw.Queue {
		// Exclude
		//	System Queues
		// 	Dynamic Queues
		//  Model Queues
		if strings.Contains(qi.Name, "SYSTEM") ||
			strings.Contains(qi.Dynamic.Type, "Dynamic") ||
			strings.Contains(qi.Type, "model") {
			continue
		}

		// Check queue depth
		if 0 == qi.Status.CurrentDepth {
			continue
		}

		slog.Info("QueueChecker: Processing", "queue", qi.Name)
		qdFiltered.Queue = append(qdFiltered.Queue, qi)
	}

	return &qdFiltered
}

func (qc queueChecker) logBody(r io.Reader) {
	buf := make([]byte, 2048)
	for {
		_, err := r.Read(buf)

		slog.Info(string(buf[:]))

		if nil != err {
			if io.EOF != err {
				slog.Warn("QueueChecker: Error reading body", "error", err)
			} else {
				slog.Info("QueueChecker: End of body")
			}
			break
		}
	}
}
