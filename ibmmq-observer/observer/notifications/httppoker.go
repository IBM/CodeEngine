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
	"bytes"
	"context"
	"fmt"

	"encoding/json"
	"log/slog"
	"net/http"
)

type httpPoker struct {
	client *http.Client
}

func (hp httpPoker) poke(url string, data map[string]string) error {
	slog.Info("HttpPoker: Building GET request for poke notification")

	jsonData, err := json.Marshal(data)
	if nil != err {
		slog.Warn("HttpPoker: Unable to marshal data", "error", err)
		return err
	}

	bytesData := bytes.NewBuffer(jsonData)

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		url, bytesData)

	if nil != err {
		return err
	}

	slog.Info("HttpPoker: About to invoke poke notification")
	res, err := hp.client.Do(req)
	if nil != err {
		slog.Warn("HttpPoker: Error invoking poke url", "error", err)
		return err
	}
	slog.Info("HttpPoker: Call", "status", res.Status)

	if res.StatusCode != http.StatusOK {
		slog.Warn(fmt.Sprintf("HttpPoker: unexpected status: got %v", res.Status))
		return err
	}

	return nil
}
