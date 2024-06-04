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

	"consumer/constant"
)

type mqenv struct {
	Qmgr     string `json:"QMGR"`
	User     string `json:"APP_USER"`
	Password string `json:"APP_PASSWORD"`
}

type MqRequest struct {
	Qmgr  string
	Queue string
}

type consumerConfig struct {
	Points []mqenv `json:"MQ_ENDPOINTS"`
}

type Config struct {
	consConfig consumerConfig
}

func (e Config) NumMQPoints() int {
	return len(e.consConfig.Points)
}

func (e *Config) LoadMQEndpoints() {
	slog.Info("Env: Loading MQ endpoints configuration")
	e.loadEnvFile()
	if err := e.verifyLoadForMQ(); nil == err {
		e.environmentMQOverides()
		e.fillMQBlanks()
	}
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
	json.Unmarshal(byteValue, &e.consConfig)
}

func (e *Config) verifyLoadForMQ() error {
	if len(e.consConfig.Points) == 0 {
		return fmt.Errorf("Env: No MQ endpoints found in configuration file")
	}
	return nil
}

func (e *Config) environmentMQOverides() {
	var values mqenv

	overrides := map[string]*string{
		constant.KEY_APP_USER:     &values.User,
		constant.KEY_APP_PASSWORD: &values.Password,
		constant.KEY_QMGR:         &values.Qmgr,
	}

	// Allow for non-suffixed overrides
	if e.checkOverrides(&overrides, "") {
		e.fillMQSlot(&values, 0)
	}

	// slog.Info("Env: Applying", "overrides", values)
	// Suffixed overrides starting with 0
	for i, _ := range e.consConfig.Points {
		if e.checkOverrides(&overrides, strconv.Itoa(i)) {
			e.fillMQSlot(&values, i)
		}
	}

	// Suffixed overrides, beyond count in env.json specification
	for i := len(e.consConfig.Points); i < constant.MAX_MQ_POINTS; i++ {
		if !e.checkOverrides(&overrides, strconv.Itoa(i)) {
			break
		}

		// default to last set of values, before overriding
		mqPoint := mqenv(values)
		e.consConfig.Points = append(e.consConfig.Points, mqPoint)
		e.fillMQSlot(&values, i)
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

func (e *Config) fillMQSlot(values *mqenv, i int) {
	if val := strings.TrimSpace(values.User); 0 < len(val) {
		e.consConfig.Points[i].User = val
	}
	if val := strings.TrimSpace(values.Password); 0 < len(val) {
		e.consConfig.Points[i].Password = val
	}
	if val := strings.TrimSpace(values.Qmgr); 0 < len(val) {
		e.consConfig.Points[i].Qmgr = val
	}
}

func (e *Config) fillMQBlanks() {
	slog.Info("Env: Filling blanks found in environment settings")

	for i, v := range e.consConfig.Points {
		if 0 == len(strings.TrimSpace(v.User)) {
			e.consConfig.Points[i].User = e.consConfig.Points[0].User
		}
		if 0 == len(strings.TrimSpace(v.Password)) {
			e.consConfig.Points[i].Password = e.consConfig.Points[0].Password
		}
		if 0 == len(strings.TrimSpace(v.Qmgr)) {
			e.consConfig.Points[i].Qmgr = e.consConfig.Points[0].Qmgr
		}
	}
}

func (e Config) CCDTPath() (string, error) {
	fPath := ""
	if fPath = os.Getenv(constant.KEY_CCDT); "" == fPath {
		slog.Info("Env: Defaulting CCDT")
		fPath = constant.DEFAULT_CCDT_PATH
		if err := os.Setenv(constant.KEY_CCDT, constant.DEFAULT_CCDT_PATH); nil != err {
			slog.Warn("Env: unable to default CCDT settings")
			return "", err
		}
	}
	return fPath, nil
}

func (e Config) CheckRequest() (*MqRequest, error) {
	ok := true
	var req MqRequest

	if qmgr := os.Getenv(constant.KEY_REQUEST_QMGR); "" == qmgr {
		slog.Warn("Env: No Queue Manage in request")
		ok = false
	} else {
		req.Qmgr = qmgr
	}

	if queue := os.Getenv(constant.KEY_REQUEST_QUEUE); "" == queue {
		slog.Warn("Env: No Queue in request")
		ok = false
	} else {
		req.Queue = queue
	}

	if ok {
		for _, p := range e.consConfig.Points {
			if p.Qmgr == req.Qmgr {
				slog.Info("Env: Request matches queue manger in configuration")
				return &req, nil
			}
			slog.Warn("Env: No match in configuration for", "qmgr", req.Qmgr)
		}
	}

	return nil, fmt.Errorf("Env: Error determining request")
}

func (e Config) GetCredsFor(qmgr string) (string, string) {
	for _, p := range e.consConfig.Points {
		if p.Qmgr == qmgr {
			return p.User, p.Password
		}
	}
	return "", ""
}

func (e Config) GetKeyStoreLocation() string {
	keyStore := ""
	if keyStore = os.Getenv(constant.KEY_KEY_STORE); "" == keyStore {
		slog.Info("Env: Defaulting Key Store")
		keyStore = constant.DEFAULT_KEY_STORE
	}
	return keyStore
}
