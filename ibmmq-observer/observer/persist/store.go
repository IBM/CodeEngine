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

package persist

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"observer/constant"
	"observer/cos"
	"observer/observerrequests"
)

type store struct {
	decided       bool
	envVarChecked bool
	theStore      iPersister
}

// NB. parameter is a template, so it is expecting a
// pointer to an acutal implementation.
func (s *store) storeDecided(storeImp iPersister) {
	if !s.decided {
		slog.Info("Store: Persistence implementation indentified")
		s.theStore = storeImp
		s.decided = true
	}
}

func (s *store) save(regs *observerrequests.ObserverRequests) (bool, error) {
	slog.Info("Store: Will be persisting", "registrations", len(regs.Requests))
	changes := false
	if constant.UseCOSStorage() {
		slog.Info("Store: Persisting to cloud object storage")

		s.storeDecided(&cos.CosStore{})
		if altered, err := s.theStore.Save(regs); nil != err {
			slog.Warn("Store: Error attempting save", "error", err)
			return altered, err
		} else {
			changes = altered
		}
	} else {
		return changes, fmt.Errorf("Store: No persistent storage identified")
	}
	return changes, nil
}

func (s *store) checkEnvVar() *observerrequests.ObserverRequests {
	if !s.envVarChecked {
		slog.Info("Store: Checking seed registrations via envrionment settings")
		s.envVarChecked = true
		// need to ensure this is at start up only
		if data, ok := os.LookupEnv(constant.KEY_REG_SEED_DATA); ok {
			slog.Info("Store: Seed registration data", "from env", data)

			// crib from last few lines of cosstore load - unmarshall
			var requests observerrequests.ObserverRequests
			if err := json.Unmarshal([]byte(data), &requests); nil != err {
				slog.Warn("Store: data unmarshalling seed registrations", "error", err)
				return nil
			}
			slog.Info("Store: retrieved seed registrations", "data", requests)
			return &requests
		}
	}
	return nil
}

func (s *store) load() (*observerrequests.ObserverRequests, error) {
	slog.Info("Store: Will be retrieving registrations from storage")

	if seedRegs := s.checkEnvVar(); nil != seedRegs {
		slog.Info("Store: Starting with seed registrations via env variable")
		return seedRegs, nil
	}

	if constant.UseCOSStorage() {
		slog.Info("Store: Reading from cloud object storage")

		s.storeDecided(&cos.CosStore{})
		if requests, err := s.theStore.Load(); nil != err {
			slog.Info("Store: Failed to read from cloud object storage")
			return nil, err
		} else {
			return requests, nil
		}
	} else {
		slog.Warn("Store: No persistent storage identified")
	}

	slog.Info("Store: Storage load action not yet implemented")
	return nil, nil
}
