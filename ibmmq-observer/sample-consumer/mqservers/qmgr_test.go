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
	"testing"

	"consumer/constant"
)

// Test queue managers load
func Test_qmgrLoad(t *testing.T) {
	var qmgrs QueueManagers

	if err := qmgrs.Load(); nil == err {
		t.Errorf("Did not get expected error loading qmgrs")
	}

	t.Setenv(constant.KEY_ENV_FILE, "../env.json")
	if err := qmgrs.Load(); nil != err {
		t.Errorf("Unexpected error loading qmgrs %v", err)
	}
}

// Test CCDT Check
func Test_ccdtCheck(t *testing.T) {
	var qmgrs QueueManagers

	if err := qmgrs.CheckCCDT(); nil == err {
		t.Errorf("Did not get expected error checking CCDT")
	}

	t.Setenv(constant.KEY_CCDT, "../ccdt.json")
	if err := qmgrs.CheckCCDT(); nil != err {
		t.Errorf("Unexpected error checking CCDT %v", err)
	}
}

func bulidQMGRS(t *testing.T) *QueueManagers {
	t.Setenv(constant.KEY_ENV_FILE, "../env.json")
	var qmgrs QueueManagers
	qmgrs.Load()

	return &qmgrs
}

// Test incoming request check
func Test_incomingBadRequst(t *testing.T) {
	dummyQmgr := "dummyQmgr"
	dummyQueue := "dummyQueue"

	t.Setenv(constant.KEY_REQUEST_QMGR, dummyQmgr)

	qmgrs := bulidQMGRS(t)

	// Expect missing queue
	if err := qmgrs.CheckIncomingRequest(); nil == err {
		t.Errorf("Did not get expected error incoming request")
	}

	// Expect qmgr mismatch
	t.Setenv(constant.KEY_REQUEST_QUEUE, dummyQueue)

	if err := qmgrs.CheckIncomingRequest(); nil == err {
		t.Errorf("Did not get expected qm mismatch error")
	}
}

func setGoodQueueEnv(t *testing.T) *QueueManagers {
	dummyQmgr := "dummyQmgr"
	dummyQueue := "dummyQueue"

	t.Setenv(constant.KEY_REQUEST_QMGR, dummyQmgr)
	t.Setenv(constant.KEY_REQUEST_QUEUE, dummyQueue)
	t.Setenv(constant.KEY_QMGR, dummyQmgr)

	return bulidQMGRS(t)
}

// Test incoming request check
func Test_incomingGoodRequst(t *testing.T) {
	qmgrs := setGoodQueueEnv(t)

	if err := qmgrs.CheckIncomingRequest(); nil != err {
		t.Errorf("Got unexpected error checking incoming request : %v", err)
	}
}

// Test process queue error
func Test_processQueueError(t *testing.T) {
	qmgrs := setGoodQueueEnv(t)

	if err := qmgrs.CheckIncomingRequest(); nil != err {
		t.Fatalf("Got unexpected error checking incoming request : %v", err)
	}

	if err := qmgrs.ProcessQueue(); nil == err {
		t.Errorf("Did not get expected process queue error")
	}
}
