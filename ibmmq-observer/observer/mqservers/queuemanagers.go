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

package mqservers

import (
	"log/slog"

	"observer/common"
	"observer/configuration"
)

type QueueManagers struct {
	eps configuration.Config
}

func (qms *QueueManagers) Load() {
	slog.Info("QueueManagers: Loading list of MQ queue managers to monitor")
	qms.eps.LoadMQEndpoints()

	slog.Info("QueueManagers: Post Loading number of MQ", "points", qms.eps.NumMQPoints())
}

func (qms *QueueManagers) BuildURLFor(qmgr string) (string, common.Credentials) {
	slog.Info("QueueManagers: Building URL for", "qmgr", qmgr)
	slog.Info("QueueManagers: Number of", "points", qms.eps.NumMQPoints())

	url, creds := qms.eps.URLForQM(qmgr)

	slog.Info("QueueManagers: Returning", "URL", url)
	return url, creds
}
