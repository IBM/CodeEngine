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
	"testing"

	"observer/common"
	"observer/constant"
)

func Test_checkRegistrationsStore(t *testing.T) {
	dummyId := "dummyId"
	dummyQmgr := "dummyQmgr"
	dummyQueue := "dummyQueue"
	dummyNotify := "dummyNotify"

	var regs Registrations

	// Initialise the Registrations store
	regs.initRegistrations()
	if numRegs := len(regs.activeRegistrations); 0 < numRegs {
		t.Errorf("incorrect result: expected %d, got %d", 0, numRegs)
	}

	// Create a new Registration
	var registration RegistrationRequest
	if err := registration.checkId(); nil == err {
		t.Error("registration id check should have failed")
	}

	// Validate the registration
	if err := registration.validate(); nil == err {
		t.Error("registration should have failed validation")
	}

	// Assign dummy values
	registration.id = dummyId
	registration.qmgr = dummyQmgr
	registration.queue = dummyQueue
	registration.notify = dummyNotify

	// Check the id
	if err := registration.checkId(); nil != err {
		t.Error("Id Check: registration id check should have succeeded")
	}

	// Validate the registration #2
	if err := registration.validate(); nil != err {
		t.Errorf("Registration validation check: should have succeeded validation %v", err)
	}

	// Convert to json friendly format
	var jr jsonRequest
	jr.set(registration)
	if qmgr := jr.Qmgr; qmgr != dummyQmgr {
		t.Errorf("Json convert check: incorrect result: expected %s, got %s", dummyQmgr, qmgr)
	}

	// Add the registration to the store
	regs.addRegistration(registration)
	if numRegs := len(regs.activeRegistrations); 1 != numRegs {
		t.Errorf("Add to registration check: incorrect result: expected %d, got %d", 1, numRegs)
	}

	// Check the store dirty flag
	if !regs.IsDirty() {
		t.Error("Registration dirty check: store should be dirty")
	}

	// Reset the store dirty flag
	regs.Washed()
	if regs.IsDirty() {
		t.Error("Registration clean check: store should not be dirty")
	}

	if regsCopy := regs.CopyRegistrations(common.Active); nil == regsCopy {
		t.Error("Copy registrations check: registration store should not be nil")
	} else if numCopyRegs := len(*regsCopy); 0 == numCopyRegs {
		t.Errorf("Copy registrations check: incorrect result: expected %d, got %d", 1, numCopyRegs)
	}

	// Read the registration
	if regRead, ok := regs.readRegistration(dummyId); !ok {
		t.Error("Registration read check: should have succeeded")
	} else if dummyQmgr != regRead.qmgr {
		t.Errorf("Registration read check: has wrong qmgr value expected %s got %s", dummyQmgr, regRead.qmgr)
	}

	// Signal fail registration should still be in store
	for range constant.FailTolerance() - 1 {
		regs.SignalFail(dummyId)
	}
	if numRegs := len(regs.activeRegistrations); 1 != numRegs {
		t.Errorf("Signal fail check: incorrect result: expected %d, got %d", 1, numRegs)
	}
	// Signal fail registration should have been dropped
	regs.SignalFail(dummyId)

	if constant.DropBadRegistrations() {
		if numRegs := len(regs.activeRegistrations); 0 != numRegs {
			t.Errorf("Signal fail check: After %d signal fails incorrect result: expected %d, got %d", constant.FailTolerance(), 0, numRegs)
		}
	} else {
		if numRegs := len(regs.activeRegistrations); 1 != numRegs {
			t.Errorf("Signal fail check: After %d signal fails incorrect result: expected %d, got %d", constant.FailTolerance(), 1, numRegs)
		}
	}

	// Add registration back to store
	regs.addRegistration(registration)
	if numRegs := len(regs.activeRegistrations); 1 != numRegs {
		t.Errorf("ReAdd registration check: incorrect result: expected %d, got %d", 1, numRegs)
	}

	// remove registration from the store
	regs.dropRegistration(registration)
	if numRegs := len(regs.activeRegistrations); 0 != numRegs {
		t.Errorf("Drop registration check: incorrect result: expected %d, got %d", 1, numRegs)
	}
}

func Test_checkBackoffProcess(t *testing.T) {
	dummyId := "dummyId"
	dummyQmgr := "dummyQmgr"
	dummyQueue := "dummyQueue"
	dummyNotify := "dummyNotify"

	var regs Registrations

	// Initialise the Registrations store
	regs.initRegistrations()

	// Create a new Registration
	var registration RegistrationRequest

	// Assign dummy values
	registration.id = dummyId
	registration.qmgr = dummyQmgr
	registration.queue = dummyQueue
	registration.notify = dummyNotify

	// Add the registration to the store
	regs.addRegistration(registration)

	if reg, ok := regs.readRegistration(dummyId); !ok {
		t.Error("Registration should have been found")
	} else if !reg.isActive() {
		t.Error("Registration should be active")
	} else if reg.isBackedOff() {
		t.Error("Registration should not be in backed off mode")
	} else if reg.ShouldBeReset() {
		t.Error("ShouldBeReset should return false")
	}

	// Signal fail registrations
	for range constant.FailTolerance() {
		regs.SignalFail(dummyId)
	}

	// If not dropping bad registrations, then back off logic will
	// kick in
	if !constant.DropBadRegistrations() {
		if numRegs := len(regs.activeRegistrations); 1 != numRegs {
			t.Errorf("Back off check: After %d signal fails incorrect result: expected %d, got %d", constant.FailTolerance(), 0, numRegs)
		} else if reg, ok := regs.readRegistration(dummyId); !ok {
			t.Error("Registration should have been found")
		} else if reg.isActive() {
			t.Error("Registration should not be active")
		} else if !reg.isBackedOff() {
			t.Error("Registration should be in backed off mode")
		} else {
			// Function could return true or false
			reg.ShouldBeReset()
			reg.resetBackoff()
			if !reg.isActive() {
				t.Error("Registration should be active")
			} else if reg.isBackedOff() {
				t.Error("Registration should not be in backed off mode")
			}
		}
	}
}
