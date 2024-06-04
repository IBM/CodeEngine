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

package observerrequests

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"observer/constant"
)

type jsonAcknowledge struct {
	Message string `json:"message"`
}

type jsonRequest struct {
	Id          string    `json:"id"`
	Qmgr        string    `json:"qmgr"`
	Queue       string    `json:"queue"`
	Notify      string    `json:"notify"`
	Failcount   int       `json:"failcount"`
	Backofftill time.Time `json:"backoff"`
	LastUpdated time.Time `json:"last_updated"`
}

type RegistrationRequest struct {
	id          string
	qmgr        string
	queue       string
	notify      string
	failcount   int
	backofftill time.Time
	lastupdated time.Time
}

// Any field with a json tag needs to be exported,
// and hence uppercase
type ObserverRequests struct {
	Requests    []jsonRequest `json:"mq_requests"`
	LastUpdated time.Time     `json:"last_updated"`
}

func (or *ObserverRequests) SetLastUpdated() {
	or.LastUpdated = time.Now()
}

func (or *ObserverRequests) CheckDates(oldRequests *ObserverRequests) bool {
	slog.Info("ObserverRequests: Comparing existing store data with new cached data")
	changes := false
	if oldRequests.LastUpdated.IsZero() {
		slog.Info("ObserverRequests: no timestamp on store data")
		return changes
	}
	if !(or.LastUpdated.IsZero() || oldRequests.LastUpdated.After(or.LastUpdated)) {
		slog.Info("ObserverRequests: store data has not been updated since last read")
		return changes
	}

	storeChanges := or.runThroughStoreRequests(oldRequests)
	cacheChanges := or.runThroughCacheRequests(oldRequests)

	changes = storeChanges || cacheChanges

	return changes
}

func (or *ObserverRequests) runThroughStoreRequests(oldRequests *ObserverRequests) bool {
	slog.Info("ObserverRequests: running through existing store data")
	changes := false

	for _, storedReq := range oldRequests.Requests {
		found := false
		for j, currentReq := range or.Requests {
			if currentReq.Id == storedReq.Id {
				if storedReq.LastUpdated.After(currentReq.LastUpdated) {
					slog.Info("ObserverRequests: Stored data is newer")
					or.Requests[j] = storedReq
					changes = true
				}
				found = true
				break
			}
		}
		if !found {
			slog.Info("ObserverRequests: Found record that is in store, but not in cache")
			if !storedReq.LastUpdated.IsZero() &&
				storedReq.LastUpdated.After(or.LastUpdated) {
				slog.Info("ObserverRequests: store record created since last read")

				if !storedReq.Backofftill.IsZero() {
					slog.Info("ObserverRequests: has back-off, assuming it has been marked recently")
					slog.Info("ObserverRequests: but dropped since. Will removing it from storeage")
				} else {
					or.Requests = append(or.Requests, storedReq)
					changes = true
				}
			} else {
				// Else it must have been removed, in this pass
				slog.Info("ObserverRequests: record in store will be removed")
			}
		}
	}
	return changes
}

func (or *ObserverRequests) runThroughCacheRequests(oldRequests *ObserverRequests) bool {
	slog.Info("ObserverRequests: running through cached data")
	changes := false

	dropFromCache := []int{}
	for i, cacheReq := range or.Requests {
		found := false
		for _, storedReq := range oldRequests.Requests {
			if cacheReq.Id == storedReq.Id {
				found = true
			}
		}
		if !found {
			// If store has later last updated than the record in cache
			// then its been dropped from the store.
			// Or if it has the record in cache has a back off, it
			// may have been updated just with the backoff.
			if oldRequests.LastUpdated.After(cacheReq.LastUpdated) ||
				!cacheReq.Backofftill.IsZero() {
				dropFromCache = append(dropFromCache, i)
			}
		}
	}
	if 0 < len(dropFromCache) {
		slog.Info("ObserverRequests:", "items to be dropped from cache", len(or.Requests))

		slices.Reverse(dropFromCache)
		for _, pos := range dropFromCache {
			or.Requests = slices.Delete(or.Requests, pos, pos+1)
		}

		changes = true
	}

	return changes
}

func (jr *jsonRequest) set(rr RegistrationRequest) {
	jr.Id = rr.id
	jr.Qmgr = rr.qmgr
	jr.Queue = rr.queue
	jr.Notify = rr.notify
	jr.Failcount = rr.failcount
	jr.Backofftill = rr.backofftill
	jr.LastUpdated = rr.lastupdated
}

// func (jr *jsonRequest) copy() {
// 	jrCopy := jsonRequest(jr...)
// 	return &jrCopy
// }

func (rr *RegistrationRequest) FromJsonRequest(jr jsonRequest) {
	rr.id = jr.Id
	rr.qmgr = jr.Qmgr
	rr.queue = jr.Queue
	rr.notify = jr.Notify
	rr.failcount = jr.Failcount
	rr.backofftill = jr.Backofftill
	rr.lastupdated = jr.LastUpdated
}

func (rr RegistrationRequest) GetQmgr() string {
	return rr.qmgr
}

func (rr RegistrationRequest) GetQueue() string {
	return rr.queue
}

func (rr RegistrationRequest) GetNotify() string {
	return rr.notify
}

func (rr RegistrationRequest) GetId() string {
	return rr.id
}

func (rr RegistrationRequest) checkId() error {
	if 0 == len(rr.id) {
		return fmt.Errorf("%s needs to be specified", constant.ID)
	}
	return nil
}

func (rr *RegistrationRequest) failed() int {
	rr.failcount += 1
	return rr.failcount
}

func (rr *RegistrationRequest) setbackoff() {
	rr.backofftill = time.Now().Add(constant.DetermineInterval(constant.KEY_BACKOFF_DURATION))
	rr.setlastupdated()
}

func (rr *RegistrationRequest) setlastupdated() {
	rr.lastupdated = time.Now()
}

func (rr RegistrationRequest) isActive() bool {
	return (!constant.IsFailureExcessive(rr.failcount)) &&
		rr.backofftill.IsZero()
}

func (rr RegistrationRequest) isBackedOff() bool {
	return !rr.backofftill.IsZero()
}

func (rr RegistrationRequest) ShouldBeReset() bool {
	slog.Info("RegistrationRequest: Checking if back off can be reset")
	return !rr.backofftill.IsZero() &&
		time.Now().After(rr.backofftill)
}

func (rr *RegistrationRequest) resetBackoff() {
	slog.Info("RegistrationRequest: Removing backoff for registration")
	var zeroTime time.Time
	rr.failcount = 0
	rr.backofftill = zeroTime
	rr.setlastupdated()
}

func (rr RegistrationRequest) validate() error {
	var err error

	if 0 == len(rr.qmgr) {
		err = errors.Join(err, fmt.Errorf("%s needs to be specified", constant.QMGR))
	}
	if 0 == len(rr.queue) {
		err = errors.Join(err, fmt.Errorf("%s needs to be specified", constant.QUEUE))
	}
	if 0 == len(rr.notify) {
		err = errors.Join(err, fmt.Errorf("%s needs to be specified", constant.NOTIFY))
	}

	return err
}

func (rr *RegistrationRequest) fromForm(r *http.Request) {
	if id := strings.TrimSpace(r.FormValue(constant.ID)); 0 == len(id) {
		rr.id = uuid.New().String()
	} else {
		rr.id = id
	}

	rr.qmgr = strings.TrimSpace(r.FormValue(constant.QMGR))
	rr.queue = strings.TrimSpace(r.FormValue(constant.QUEUE))
	rr.notify = strings.TrimSpace(r.FormValue(constant.NOTIFY))
	rr.setlastupdated()
}

func (rr *RegistrationRequest) fromJson(r *http.Request) error {
	var reg jsonRequest

	// decode input or return error
	var err error = json.NewDecoder(r.Body).Decode(&reg)
	if nil == err {
		if 0 == len(reg.Id) {
			rr.id = uuid.New().String()
		} else {
			rr.id = reg.Id
		}

		slog.Info("RegistrationRequest: json pulled", "data", reg)
		rr.qmgr = reg.Qmgr
		rr.queue = reg.Queue
		rr.notify = reg.Notify
		rr.setlastupdated()
	}
	return err
}

func (rr RegistrationRequest) AsTransformedMap() map[string]string {
	data := map[string]string{"notification": "messages found on queue"}

	data[constant.ID] = rr.id
	data[constant.CE_QMGR] = rr.qmgr
	data[constant.CE_QUEUE] = rr.queue

	return data
}
