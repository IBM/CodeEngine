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
	"log/slog"
	"time"

	"observer/common"
	"observer/constant"
	"observer/observerrequests"
)

type Persister struct {
	ActiveRegistrations *observerrequests.Registrations
	storage             store
}

func (p *Persister) Start() {
	slog.Info("Persister: Persister starting up")

	sleep_interval := p.determinePersistInterval()
	currentCount := 0

	for {
		slog.Info("Persister: Persister going to sleep")
		time.Sleep(sleep_interval)

		slog.Info("Persister: Persister checking if registration store is dirty")
		if isDirty := p.ActiveRegistrations.IsDirty(); isDirty {
			slog.Info("Persister: Registration store is dirty")
			slog.Info("Persister: Persisting the registration store")
			p.consolidateCacheWithStore()
			currentCount = 0
		} else if common.AllFunctions != constant.DetermineRunMode() {
			currentCount++
			if currentCount >= constant.MAX_NOSTORE_ITERATIONS {
				slog.Info("Persister: dating current registrations cache against store")
				p.consolidateCacheWithStore()
			}
		}
	}
}

func (p *Persister) consolidateCacheWithStore() {
	// This will get a copy of all registrations
	// which need to be persisted
	registrations := p.ActiveRegistrations.CopyObserverRequests(common.All)
	if changes, err := p.storage.save(registrations); nil != err {
		slog.Warn("Persister: error saving to storage", "error", err)
		return
	} else if changes {
		// May happen if multiple observer apps are writing to the store.
		slog.Info("Persister: data drift detected between cache and store")
		p.ActiveRegistrations.DataFromStore(registrations)
	}
	slog.Info("Persister: Cache is now clean")
	p.ActiveRegistrations.Washed()
}

func (p *Persister) Load() (*observerrequests.ObserverRequests, error) {
	regs, err := p.storage.load()
	slog.Info("Store: Registrations retrieved")
	return regs, err
}

func (p Persister) determinePersistInterval() time.Duration {
	i := constant.DetermineInterval(constant.KEY_PERSIST_INTERVAL)
	slog.Info("Persister: Persist interval override found", "minutes", i)
	return i
}
