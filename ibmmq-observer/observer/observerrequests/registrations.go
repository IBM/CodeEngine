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
	"log/slog"
	"sync"
	"time"

	"observer/common"
	"observer/constant"
)

// Manages access to the store of registrations using a
// RW Mutex to control concurrent access.
type Registrations struct {
	lock                 sync.RWMutex
	activeRegistrations  map[string]RegistrationRequest
	dirty                bool
	dropBadRegs          bool
	lastupdatedfromstore time.Time
}

func (r *Registrations) initRegistrations() {
	slog.Info("Registrations: Creating registrations registry")
	r.activeRegistrations = make(map[string]RegistrationRequest)

	r.dropBadRegs = constant.DropBadRegistrations()
}

func (r *Registrations) IsDirty() bool {
	return r.dirty
}

func (r *Registrations) setDirty() {
	r.dirty = true
}

func (r *Registrations) Washed() {
	r.dirty = false
	// Data should now match that of the store
	r.lastupdatedfromstore = time.Now()
}

func (r *Registrations) DataFromStore(persistRegs *ObserverRequests) {
	r.lock.Lock()
	defer r.lock.Unlock()

	if nil != persistRegs && 0 < len(r.activeRegistrations) {
		slog.Info("Registrations: Active registrations found, may be overridden by persisted registrations")
		// If needed flush by remaking the map
		r.initRegistrations()
	}

	if nil == r.activeRegistrations {
		r.initRegistrations()
	}

	for _, regRequest := range persistRegs.Requests {
		var rr RegistrationRequest
		rr.FromJsonRequest(regRequest)
		r.activeRegistrations[regRequest.Id] = rr
	}
	r.lastupdatedfromstore = persistRegs.LastUpdated
	slog.Info("Registrations: registrations from store ", "count", len(r.activeRegistrations))
}

func (r *Registrations) CopyRegistrations(regstatus common.RegistrationStatus) *map[string]RegistrationRequest {
	r.lock.RLock()
	defer r.lock.RUnlock()

	registrationsCopy := make(map[string]RegistrationRequest)

	for key, regRequest := range r.activeRegistrations {
		doCopy := false
		switch regstatus {
		case common.Active:
			slog.Info("Registrations: Only looking for Active registrations")
			doCopy = regRequest.isActive()
		case common.BackedOff:
			doCopy = regRequest.isBackedOff()
		default:
			slog.Info("Registrations: Looking for All registrations")
			doCopy = true
		}

		if doCopy {
			reqCopy := RegistrationRequest(regRequest)
			registrationsCopy[key] = reqCopy
		}
	}

	return &registrationsCopy
}

func (r *Registrations) CopyObserverRequests(regstatus common.RegistrationStatus) *ObserverRequests {
	registrationsCopy := r.CopyRegistrations(regstatus)

	var or ObserverRequests
	for _, reg := range *registrationsCopy {
		var jr jsonRequest
		jr.set(reg)
		or.Requests = append(or.Requests, jr)
	}
	or.LastUpdated = r.lastupdatedfromstore
	return &or
}

func (r *Registrations) readRegistration(id string) (RegistrationRequest, bool) {
	r.lock.RLock()
	defer r.lock.RUnlock()
	v, ok := r.activeRegistrations[id]
	return v, ok
}

func (r *Registrations) addRegistration(newReg RegistrationRequest) {
	r.lock.Lock()
	defer r.lock.Unlock()
	if nil == r.activeRegistrations {
		r.initRegistrations()
	}
	slog.Info("Registrations: Adding/Updating registrations registry entry")
	r.activeRegistrations[newReg.id] = newReg
	r.setDirty()
}

func (r *Registrations) dropRegistration(existingReg RegistrationRequest) {
	r.lock.Lock()
	defer r.lock.Unlock()
	slog.Info("Registrations: dropping registration")
	if nil != r.activeRegistrations {
		slog.Info("Registrations: Removing existing entry from registrations registry")
		delete(r.activeRegistrations, existingReg.id)
	}
	r.setDirty()
}

func (r *Registrations) dropAllRegistrations() int {
	if numReg := len(r.activeRegistrations); numReg > 0 {
		slog.Info("Registrations: dropping all", "registrations count", numReg)

		r.lock.Lock()
		defer r.lock.Unlock()

		r.initRegistrations()
		r.setDirty()

		return numReg
	}
	return 0
}

func (r *Registrations) SignalFail(id string) {
	slog.Info("Registrations: Checking failure count for", "registration", id)

	if badBoyRegistration, ok := r.readRegistration(id); ok {
		failcount := badBoyRegistration.failed()

		slog.Info("Registrations: Failed", "count", failcount)

		// If we are not dropping bad registrations, and
		// the failure count is already over the limit,
		// leave it as is.
		// That way the int holding the count should not overflow.
		// Check if a backoff till value has been set.
		if !r.dropBadRegs &&
			constant.IsFailureExcessive(failcount) {
			// If there is no backoff duration, then set one.
			if badBoyRegistration.backofftill.IsZero() {
				slog.Info("Registrations: Backing off notifications")
				badBoyRegistration.setbackoff()
				r.addRegistration(badBoyRegistration)
			}
			return
		}

		// If we are dropping bad registrations then check
		// to see if it needs to be dropped.
		// If not to be dropped then increment the failure count
		// by saving the updated registration.
		if r.dropBadRegs &&
			constant.IsFailureExcessive(failcount) {
			slog.Warn("Registrations: Failure count exceeded for this registration", "id", id)
			r.dropRegistration(badBoyRegistration)
		} else {
			// Put back into registration map
			r.addRegistration(badBoyRegistration)
		}
	}
}

func (r *Registrations) ResetBackoff(id string) {
	slog.Info("Registrations: Resetting back off and failure for", "registration", id)
	if restoreReg, ok := r.readRegistration(id); ok {
		restoreReg.resetBackoff()
		// Put back into registration map
		r.addRegistration(restoreReg)
	}
}
