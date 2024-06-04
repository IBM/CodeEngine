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
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"observer/common"
	"observer/constant"
)

// Any field with a json tag needs to be exported,
// and hence uppercase
type observerConfig struct {
	Points     []mqenv    `json:"MQ_ENDPOINTS"`
	Cos        cosDetails `json:"COS_STORAGE"`
	CodeEngine ceDetails  `json:"CODE_ENGINE"`
}

type Config struct {
	obsConfig observerConfig
}

func (e *Config) LoadCodeEngineConfig() {
	slog.Info("Env: Loading code engine configuration")
	e.loadEnvFile()
	e.verifyLoadForCodeEngine()
	e.environmentCodeEngineOverides()
	e.codeEngineDefaults()
}

func (e *Config) LoadCosStorageConfig() {
	slog.Info("Env: Loading storage configuration")
	e.loadEnvFile()
	e.verifyLoadForStorage()
	e.environmentStorageOverides()
	e.storageDefaults()
}

func (e Config) CosEndpoint() string {
	return e.obsConfig.Cos.Endpoints
}

func (e Config) CosAuthEndpoint() string {
	return e.obsConfig.Cos.AuthEndpoint
}

func (e Config) CosAPIKey() string {
	return e.obsConfig.Cos.ApiKey
}

func (e Config) CosInstanceId() string {
	return e.obsConfig.Cos.InstanceId
}

func (e Config) CosBucket() string {
	return e.obsConfig.Cos.Bucket
}

func (e Config) CosDataKey() string {
	return e.obsConfig.Cos.DataKey
}

func (e Config) CodeEngineAuthEndpoint() string {
	return e.obsConfig.CodeEngine.AuthEndpoint
}

func (e Config) CodeEngineAPIKey() string {
	return e.obsConfig.CodeEngine.ApiKey
}

func (e Config) CodeEngineClientId() string {
	return e.obsConfig.CodeEngine.ClientId
}

func (e Config) CodeEngineClientSecret() string {
	return e.obsConfig.CodeEngine.ClientSecret
}

func (e Config) CodeEngineRegions() []string {
	regions := []string{}

	for _, region := range e.obsConfig.CodeEngine.Regions {
		regions = append(regions, region.region())
	}

	return regions
}

func (e *Config) LoadMQEndpoints() {
	slog.Info("Env: Loading MQ endpoints configuration")
	e.loadEnvFile()
	if err := e.verifyLoadForMQ(); nil == err {
		e.environmentMQOverides()
		e.fillMQBlanks()
	}
}

func (e Config) NumMQPoints() int {
	return len(e.obsConfig.Points)
}

func (e Config) URLForQM(qmgr string) (string, common.Credentials) {
	var url string
	var creds common.Credentials
	for _, pt := range e.obsConfig.Points {
		slog.Info("QueueManagers: Comparing", pt.Qmgr, qmgr)
		if 0 == strings.Compare(pt.Qmgr, qmgr) {
			slog.Info("QueueManagers: Matching", "Queue Manager ", qmgr)
			url, creds = pt.buildURL()
			break
		}
	}
	return url, creds
}

func (e *Config) loadEnvFile() {
	fileName := os.Getenv(constant.KEY_ENV_FILE)
	if fileName == "" {
		fileName = constant.DEFAULT_ENV_FILE
	}
	slog.Info("Env: Loading from", "env file", fileName)

	jsonFile, err := os.Open(fileName)
	defer jsonFile.Close()

	if err != nil {
		slog.Error("Env: Unable to load env file", "error", err)
		return
	}

	byteValue, _ := io.ReadAll(jsonFile)
	json.Unmarshal(byteValue, &e.obsConfig)
}

func (e *Config) verifyLoadForMQ() error {
	if len(e.obsConfig.Points) == 0 {
		return fmt.Errorf("Env: No MQ endpoints found in configuration file")
	}
	return nil
}

func (e *Config) verifyLoadForStorage() {
	if len(e.obsConfig.Cos.Endpoints) == 0 {
		slog.Warn("Env: No COS endpoints found in configuration file")
	}
}

func (e *Config) verifyLoadForCodeEngine() {
	if len(e.obsConfig.CodeEngine.ApiKey) == 0 {
		slog.Warn("Env: No Code Engine apikey found in configuration file")
	}
}

func (e Config) checkOverrides(overrides *map[string]*string, suffix string) bool {
	slog.Info("Env: Looking for Environment Overrides", "suffix", suffix)
	found := false
	for f, v := range *overrides {
		f += suffix
		slog.Info("Env: Overide for ", "field", f)
		s := os.Getenv(f)
		if s != "" {
			*v = s
			slog.Info("Env: Overridden")
			found = true
		}
	}
	return found
}

func (e *Config) checkRegionOverrides() {
	regions := []string{}

	regionList := os.Getenv(constant.KEY_CE_REGIONS)

	if "" == regionList {
		slog.Info("Env: No regions override specified")
		return
	}

	regions = strings.Split(regionList, ",")

	if 0 < len(regions) {
		slog.Info("Env: Overriding", "regions", regions)
		ceRegions := []ceRegion{}

		for _, region := range regions {
			reg := ceRegion{Region: region}
			ceRegions = append(ceRegions, reg)
		}

		e.obsConfig.CodeEngine.Regions = ceRegions
	}
}

func (e *Config) environmentMQOverides() {
	var values mqenv

	overrides := map[string]*string{
		constant.KEY_ADMIN_USER:     &values.User,
		constant.KEY_ADMIN_PASSWORD: &values.Password,
		constant.KEY_QMGR:           &values.Qmgr,
		constant.KEY_MQ_HOST:        &values.MQHost,
		constant.KEY_MQ_PORT:        &values.MQPort,
	}

	// Allow for non-suffixed overrides
	if e.checkOverrides(&overrides, "") {
		e.fillMQSlot(&values, 0)
	}

	// slog.Info("Env: Applying", "overrides", values)
	// Suffixed overrides starting with 0
	for i, _ := range e.obsConfig.Points {
		if e.checkOverrides(&overrides, strconv.Itoa(i)) {
			e.fillMQSlot(&values, i)
		}
	}

	// Suffixed overrides, beyond count in env.json specification
	for i := len(e.obsConfig.Points); i < constant.MAX_MQ_POINTS; i++ {
		if !e.checkOverrides(&overrides, strconv.Itoa(i)) {
			break
		}

		// default to last set of values, before overriding
		mqPoint := mqenv(values)
		e.obsConfig.Points = append(e.obsConfig.Points, mqPoint)
		e.fillMQSlot(&values, i)
	}
}

func (e *Config) fillMQSlot(values *mqenv, i int) {
	if val := strings.TrimSpace(values.User); 0 < len(val) {
		e.obsConfig.Points[i].User = val
	}
	if val := strings.TrimSpace(values.Password); 0 < len(val) {
		e.obsConfig.Points[i].Password = val
	}
	if val := strings.TrimSpace(values.Qmgr); 0 < len(val) {
		e.obsConfig.Points[i].Qmgr = val
	}
	if val := strings.TrimSpace(values.MQHost); 0 < len(val) {
		e.obsConfig.Points[i].MQHost = val
	}
	if val := strings.TrimSpace(values.MQPort); 0 < len(val) {
		e.obsConfig.Points[i].MQPort = val
	}
}

func (e *Config) environmentStorageOverides() {
	var values cosDetails

	overrides := map[string]*string{
		constant.KEY_COS_APIKEY:        &values.ApiKey,
		constant.KEY_COS_ENDPOINTS:     &values.Endpoints,
		constant.KEY_COS_AUTH_ENDPOINT: &values.AuthEndpoint,
		constant.KEY_COS_INSTANCE_ID:   &values.InstanceId,
		constant.KEY_COS_BUCKET:        &values.Bucket,
	}

	e.checkOverrides(&overrides, "")

	if val := strings.TrimSpace(values.ApiKey); 0 < len(val) {
		e.obsConfig.Cos.ApiKey = val
	}
	if val := strings.TrimSpace(values.Endpoints); 0 < len(val) {
		e.obsConfig.Cos.Endpoints = val
	}
	if val := strings.TrimSpace(values.AuthEndpoint); 0 < len(val) {
		e.obsConfig.Cos.AuthEndpoint = val
	}
	if val := strings.TrimSpace(values.InstanceId); 0 < len(val) {
		e.obsConfig.Cos.InstanceId = val
	}
	if val := strings.TrimSpace(values.Bucket); 0 < len(val) {
		e.obsConfig.Cos.Bucket = val
	}
}

func (e *Config) storageDefaults() {
	if 0 == len(e.obsConfig.Cos.AuthEndpoint) {
		slog.Info("Env: Defaulting COS Auth Endpoint")
		e.obsConfig.Cos.AuthEndpoint = constant.DEFAULT_COS_AUTH_ENDPOINT
	}
}

func (e *Config) environmentCodeEngineOverides() {
	var values ceDetails

	overrides := map[string]*string{
		constant.KEY_CE_APIKEY:        &values.ApiKey,
		constant.KEY_CE_AUTH_ENDPOINT: &values.AuthEndpoint,
		constant.KEY_CE_CLIENT_ID:     &values.ClientId,
		constant.KEY_CE_SECRET:        &values.ClientSecret,
	}

	e.checkOverrides(&overrides, "")

	if val := strings.TrimSpace(values.ApiKey); 0 < len(val) {
		e.obsConfig.CodeEngine.ApiKey = val
	}
	if val := strings.TrimSpace(values.AuthEndpoint); 0 < len(val) {
		e.obsConfig.CodeEngine.AuthEndpoint = val
	}
	if val := strings.TrimSpace(values.ClientId); 0 < len(val) {
		e.obsConfig.CodeEngine.ClientId = val
	}
	if val := strings.TrimSpace(values.ClientSecret); 0 < len(val) {
		e.obsConfig.CodeEngine.ClientSecret = val
	}

	e.checkRegionOverrides()
}

func (e *Config) codeEngineDefaults() {
	if 0 == len(e.obsConfig.CodeEngine.ClientId) {
		slog.Info("Env: Defaulting CodeEngine ClientId")
		e.obsConfig.CodeEngine.ClientId = constant.DEFAULT_CLIENT_ID
	}
	if 0 == len(e.obsConfig.CodeEngine.ClientSecret) {
		slog.Info("Env: Defaulting CodeEngine ClientSecret")
		e.obsConfig.CodeEngine.ClientSecret = constant.DEFAULT_CLIENT_SECRET
	}
	if 0 == len(e.obsConfig.CodeEngine.AuthEndpoint) {
		slog.Info("Env: Defaulting CodeEngine Auth Endpoint")
		e.obsConfig.CodeEngine.AuthEndpoint = constant.DEFAULT_CE_AUTH_ENDPOINT
	}
}

func (e *Config) fillMQBlanks() {
	slog.Info("Env: Filling blanks found in environment settings")

	for i, v := range e.obsConfig.Points {
		if 0 == len(strings.TrimSpace(v.User)) {
			e.obsConfig.Points[i].User = e.obsConfig.Points[0].User
		}
		if 0 == len(strings.TrimSpace(v.Password)) {
			e.obsConfig.Points[i].Password = e.obsConfig.Points[0].Password
		}
		if 0 == len(strings.TrimSpace(v.Qmgr)) {
			e.obsConfig.Points[i].Qmgr = e.obsConfig.Points[0].Qmgr
		}
		if 0 == len(strings.TrimSpace(v.MQHost)) {
			e.obsConfig.Points[i].MQHost = e.obsConfig.Points[0].MQHost
		}
		if 0 == len(strings.TrimSpace(v.MQPort)) {
			e.obsConfig.Points[i].MQPort = e.obsConfig.Points[0].MQPort
		}
	}
}
