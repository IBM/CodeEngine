// Copyright 2022 IBM Corporation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package main

import (
	"bytes"
	"log"
	"os"
	"strings"
	"text/template"
)

var (
	DeniedEnvVars = []string{"KUBERNETES_", "PATH", "PWD", "HOME", "USER", "TEMP", "SHELL", "LANG", "HOSTNAME", "LC_"}
)

func CreateCloudConfigFromTemplate(conf *Config, cloudConfigTemplate *template.Template) (userData string, err error) {
	templateVars := make(map[string]interface{})
	templateVars["ENV_VARS"] = FilterEnvVars()

	log.Printf("[INFO] Customer commands: %s \n", conf.CustomerCommands)
	templateVars["CUSTOMER_COMMANDS"] = conf.CustomerCommands

	if conf.ShutDownVSI {
		templateVars["SHUT_DOWN"] = "shutdown -h now"
	} else {
		templateVars["SHUT_DOWN"] = ""
	}

	if conf.InstanceStorageMountPath != "" {
		templateVars["INSTANCE_STORAGE_MOUNT_PATH"] = conf.InstanceStorageMountPath
	} else {
		templateVars["INSTANCE_STORAGE_MOUNT_PATH"] = "/mnt/internal-storage-disk"
	}

	var tempBuffer bytes.Buffer
	err = cloudConfigTemplate.Execute(&tempBuffer, templateVars)
	if err != nil {
		return
	}

	userData = tempBuffer.String()

	// Uncomment the below line to see the generated cloud config
	// log.Printf("[DEBUG] %s", userData)

	return
}

func FilterEnvVars() map[string]string {
	envVarMap := make(map[string]string)
	envVarList := os.Environ()
	for _, envVar := range envVarList {
		envKey := strings.Split(envVar, "=")[0]
		if !ArrayContainsString(DeniedEnvVars, envKey) {
			envValue := os.Getenv(envKey)
			envVarMap[envKey] = envValue
		}
	}
	return envVarMap
}

func ArrayContainsString(s []string, str string) bool {
	for _, v := range s {
		if strings.Contains(str, v) {
			return true
		}
	}
	return false
}
