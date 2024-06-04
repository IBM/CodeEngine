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

package main

import (
	"log/slog"

	"consumer/mqservers"
)

func main() {
	slog.Info("Sample Consumer: Starting Consumer")

	var qms mqservers.QueueManagers
	if err := qms.Load(); nil != err {
		slog.Warn("Sample Consumer: Error loading queue manager configuration", "error", err)
		return
	}

	if err := qms.CheckCCDT(); nil != err {
		slog.Warn("Sample Consumer: Error checking for CCDT file", "error", err)
		return
	}

	if err := qms.CheckIncomingRequest(); nil != err {
		slog.Warn("Sample Consumer: Error checking for request", "error", err)
		return
	}

	if err := qms.ProcessQueue(); nil != err {
		slog.Warn("Sample Consumer: Error processing queue", "error", err)
		return
	}

	slog.Info("Sample Consumer: Ending Consumer")
}
