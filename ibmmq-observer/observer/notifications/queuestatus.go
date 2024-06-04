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

type queueStatus struct {
	CurrentDepth int `json:"currentDepth"`
}

type model struct {
	Type string `json:"type"`
}

type dynamic struct {
	Type string `json:"type"`
}

type queueInfo struct {
	Name    string      `json:"name"`
	Dynamic dynamic     `json:"dynamic"`
	Model   model       `json:"model"`
	Type    string      `json:"type"`
	Status  queueStatus `json:"status"`
}

type queueData struct {
	Queue []queueInfo
}
