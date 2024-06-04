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
	"strconv"
	"strings"
	"testing"

	"observer/constant"
)

// Run tests to verify operation when pointing at
// wrong file name
func Test_checkMQBadEnvConfiguration(t *testing.T) {
	t.Setenv(constant.KEY_ENV_FILE, "./badfilename.json")

	var eps Config
	eps.LoadMQEndpoints()

	if numPoints := len(eps.obsConfig.Points); 0 != numPoints {
		t.Errorf("Bad Env Test: Incorrect number of points detected expected %d, got %d", 0, numPoints)
	}
}

// Run tests to verify operation when pointing at
// correct file name, set as environment setting
func Test_checkMQGoodEnvConfiguration(t *testing.T) {
	dummyUser := "dummyUser"
	dummyHost := "dummyHost"

	t.Setenv(constant.KEY_ENV_FILE, "../env.json")
	t.Setenv(constant.KEY_ADMIN_USER, dummyUser)
	t.Setenv("BadHostKey", dummyHost)

	var eps Config
	eps.LoadMQEndpoints()

	if numPoints := len(eps.obsConfig.Points); 2 != numPoints {
		t.Fatalf("Good Env Test: Incorrect number of points detected expected %d, got %d", 0, numPoints)
	}

	if user := eps.obsConfig.Points[0].User; dummyUser != user {
		t.Errorf("Good Env Test: position 0 wrong user expected %s, got %s", dummyUser, user)
	}

	if user := eps.obsConfig.Points[1].User; dummyUser != user {
		t.Errorf("Good Env Test: position 1 wrong user expected %s, got %s", dummyUser, user)
	}

	if host := eps.obsConfig.Points[0].MQHost; dummyHost == host {
		t.Errorf("Good Env Test: Unexpected host value overridden")
	}

	if url, creds := eps.obsConfig.Points[0].buildURL(); 0 == len(url) {
		t.Errorf("MQ URL returned should not be empty")
	} else if !strings.Contains(url, constant.MQ_QUERY_CONSTRUCT) {
		t.Errorf("MQ URL should contain %s", constant.MQ_QUERY_CONSTRUCT)
	} else if !strings.Contains(url, constant.MQ_QUERY_PARAMS) {
		t.Errorf("MQ URL should contain %s", constant.MQ_QUERY_PARAMS)
	} else if 0 == len(creds.User) {
		t.Error("MQ admin user credentials should not be empty")
	} else if dummyUser != creds.User {
		t.Errorf("MQ admin user error, expected %s got %s", dummyUser, creds.User)
	}
}

func Test_mqEnvironmentOverrides(t *testing.T) {
	dummyQmgr := "dummyQmgr"

	t.Setenv(constant.KEY_ENV_FILE, "../env.json")

	for i := range 6 {
		k := constant.QMGR + strconv.Itoa(i)
		v := dummyQmgr + strconv.Itoa(i)
		t.Setenv(k, v)
	}

	var eps Config
	eps.LoadMQEndpoints()

	for i := range 6 {
		v := dummyQmgr + strconv.Itoa(i)
		if qmgr := eps.obsConfig.Points[i].Qmgr; v != qmgr {
			t.Errorf("MQ env test: position %d wrong qmgr expected %s, got %s", i, v, qmgr)
		}
	}

}

func Test_checkCosConfiguration(t *testing.T) {
	dummyBucket := "dummyBucket"
	dummyApiKey := "dummyKey"

	t.Setenv(constant.KEY_ENV_FILE, "../env.json")
	t.Setenv(constant.KEY_COS_BUCKET, dummyBucket)
	t.Setenv(constant.KEY_COS_APIKEY, dummyApiKey)

	var eps Config
	eps.LoadCosStorageConfig()

	if bucket := eps.obsConfig.Cos.Bucket; dummyBucket != bucket {
		t.Errorf("Cos: wrong bucket expected %s, got %s", dummyBucket, bucket)
	}

	if key := eps.obsConfig.Cos.ApiKey; dummyApiKey != key {
		t.Errorf("Cos: wrong bucket expected %s, got %s", dummyApiKey, key)
	}

	if objectKey := eps.obsConfig.Cos.DataKey; 0 == len(objectKey) {
		t.Errorf("Cos: Object key not found in env file")
	}

	if endpoints := eps.obsConfig.Cos.Endpoints; 0 == len(endpoints) {
		t.Errorf("Cos: endpoints not found in env file")
	}

	if id := eps.obsConfig.Cos.InstanceId; 0 == len(id) {
		t.Errorf("Cos: Instance Id not found in env file")
	}
}

func Test_checkCEConfiguration(t *testing.T) {
	dummyRegions := "dummyRegion1,dummyRegion2"
	regionCheck := []string{"dummyRegion1", "dummyRegion2"}

	t.Setenv(constant.KEY_ENV_FILE, "../env.json")
	t.Setenv(constant.KEY_CE_REGIONS, dummyRegions)

	var eps Config
	eps.LoadCodeEngineConfig()

	regions := eps.obsConfig.CodeEngine.Regions
	for i, region := range regions {
		if region.region() != regionCheck[i] {
			t.Errorf("Code Engine: wrong bucket expected %s, got %s", regionCheck[0], region)
		}
	}

	if key := eps.obsConfig.CodeEngine.ApiKey; 0 == len(key) {
		t.Errorf("Code Engine: API key not found in env file")
	}

	if clientId := eps.obsConfig.CodeEngine.ClientId; constant.DEFAULT_CLIENT_ID != clientId {
		t.Errorf("Code Engine: wrong client id expected default of %s, got %s", constant.DEFAULT_CLIENT_ID, clientId)
	}

	if clientSecret := eps.obsConfig.CodeEngine.ClientSecret; constant.DEFAULT_CLIENT_SECRET != clientSecret {
		t.Errorf("Code Engine: wrong client secret expected default of %s, got %s", constant.DEFAULT_CLIENT_SECRET, clientSecret)
	}

	if authEndpoint := eps.obsConfig.CodeEngine.AuthEndpoint; constant.DEFAULT_CE_AUTH_ENDPOINT != authEndpoint {
		t.Errorf("Code Engine: wrong auth endpoint expected default of %s, got %s", constant.DEFAULT_CE_AUTH_ENDPOINT, authEndpoint)
	}
}
