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

package configuration

import (
	"testing"

	"consumer/constant"
)

func buildConfigForTest(t *testing.T) *Config {
	var config Config
	t.Setenv(constant.KEY_ENV_FILE, "../env.json")
	config.LoadMQEndpoints()

	return &config
}

// Run tests to verify operation when pointing at
// wrong file name
func Test_checkMQBadEnvConfiguration(t *testing.T) {
	t.Setenv(constant.KEY_ENV_FILE, "./badfilename.json")

	var config Config
	config.LoadMQEndpoints()

	if numPoints := len(config.consConfig.Points); 0 != numPoints {
		t.Errorf("Bad Env Test: Incorrect number of points detected expected %d, got %d", 0, numPoints)
	}
}

// Run tests to verify operation when pointing at
// correct file name, set as environment setting
func Test_checkMQGoodEnvConfiguration(t *testing.T) {
	dummyUser := "dummyUser"
	dummyPassword := "dummyPassword"

	dummyQmgr := "dummyQmgr"
	dummyCEQmgr := "dummCEQmgr"

	t.Setenv(constant.KEY_APP_USER, dummyUser)
	t.Setenv(constant.KEY_APP_PASSWORD, dummyPassword)

	t.Setenv(constant.KEY_QMGR, dummyQmgr)
	// Check that CE_QMGR doesn't clash with QMGR
	t.Setenv(constant.KEY_REQUEST_QMGR, dummyCEQmgr)

	config := buildConfigForTest(t)

	if numPoints := len(config.consConfig.Points); 1 != numPoints {
		t.Fatalf("Good Env Test: Incorrect number of points detected expected %d, got %d", 0, numPoints)
	}

	if user := config.consConfig.Points[0].User; dummyUser != user {
		t.Errorf("Good Env Test: position 0 wrong user expected %s, got %s", dummyUser, user)
	}

	if password := config.consConfig.Points[0].Password; dummyPassword != password {
		t.Errorf("Good Env Test: position 0 wrong user expected %s, got %s", dummyPassword, password)
	}

	if qmgr := config.consConfig.Points[0].Qmgr; dummyQmgr != qmgr {
		t.Errorf("Good Env Test: position 0 wrong user expected %s, got %s", dummyQmgr, qmgr)
	}
}

func ccdtCheck(t *testing.T, config *Config, expectedPath string) {
	if fpath, err := config.CCDTPath(); nil != err {
		t.Errorf("Unexpected error on CCDT path check %v", err)
	} else if fpath != expectedPath {
		t.Errorf("Unexpected path expected %s, got %s", expectedPath, fpath)
	}
}

// Run tests to verify CCDT path lookup
func Test_checkCCDTConfiguration(t *testing.T) {
	var config Config

	// Using defaults
	ccdtCheck(t, &config, constant.DEFAULT_CCDT_PATH)

	badLocation := "../badfile.json"
	t.Setenv(constant.KEY_CCDT, "../badfile.json")

	ccdtCheck(t, &config, badLocation)
}

// Run tests to verify qmgr and queue request
func Test_checkRequest(t *testing.T) {
	config := buildConfigForTest(t)

	// Missing request
	if _, err := config.CheckRequest(); nil == err {
		t.Errorf("Expecting error on request check")
	}

	dummyQmgr := "dummyQmgr"
	dummyQueue := "dummyQueue"

	// // Missing queue
	t.Setenv(constant.KEY_REQUEST_QMGR, dummyQmgr)

	if _, err := config.CheckRequest(); nil == err {
		t.Errorf("Expecting error on request check")
	}

	// qm not as expected
	t.Setenv(constant.KEY_REQUEST_QUEUE, dummyQueue)
	if _, err := config.CheckRequest(); nil == err {
		t.Errorf("Expecting error on request check")
	}

	// qm is as expected
	t.Setenv(constant.KEY_QMGR, dummyQmgr)
	// Need to rebuild config for so QMGR is set correctly
	config = buildConfigForTest(t)

	if _, err := config.CheckRequest(); nil != err {
		t.Errorf("Unexpected error on request check %v", err)
	}
}

// Test KeyStore location function
func Test_checkKeyStore(t *testing.T) {
	var config Config

	if keyStore := config.GetKeyStoreLocation(); constant.DEFAULT_KEY_STORE != keyStore {
		t.Errorf("Incorrect keystore location expected %s, got %s", constant.DEFAULT_KEY_STORE, keyStore)
	}

	dummyStore := "dummyStoreLocation"
	t.Setenv(constant.KEY_KEY_STORE, dummyStore)

	if keyStore := config.GetKeyStoreLocation(); dummyStore != keyStore {
		t.Errorf("Incorrect keystore location expected %s, got %s", dummyStore, keyStore)
	}

}
