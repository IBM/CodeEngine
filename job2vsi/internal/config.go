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
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Region                   string   `yaml:"region" validate:"required"`
	Profile                  string   `yaml:"profile" validate:"required"`
	NamePrefix               string   `yaml:"name_prefix" validate:"required"`
	VpcID                    string   `yaml:"vpc_id" validate:"required"`
	ZoneName                 string   `yaml:"zone_name" validate:"required"`
	Image                    string   `yaml:"image" validate:"required"`
	SubnetID                 string   `yaml:"subnet_id" validate:"required"`
	FloatingIpNamePrefix     string   `yaml:"floating_ip_name_prefix" validate:"required"`
	SshKeyID                 string   `yaml:"ssh_key_id" validate:"required"`
	UserDataFilePath         string   `yaml:"user_data_file_path" validate:"required"`
	DeleteVsiAfterExecution  bool     `yaml:"delete_vsi_after_execution" validate:"required"`
	ShutDownVSI              bool     `yaml:"shut_down_vsi" validate:"required"`
	Name                     string   `yaml:"-"`
	FloatingIPName           string   `yaml:"-"`
	CustomerCommands         []string `yaml:"customer_commands"`
	InstanceStorageMountPath string   `yaml:"instance_storage_mount_path"`
	VsiTags                  []string `yaml:"vsi_tags"`
	VsiStartTimeout          int      `yaml:"vsi_start_timeout"`
}

func ReadFromPath(path string) (c Config, err error) {
	configFilePath := filepath.Clean(path)
	configFileContent, err := ioutil.ReadFile(configFilePath)
	if err != nil {
		return Config{}, err
	}

	c = Config{}
	err = yaml.Unmarshal(configFileContent, &c)
	if err != nil {
		return Config{}, errors.Errorf("Cannot unmarshal configuration yaml: %s", err)
	}

	log.Println("[INFO] Config initialized")

	jobIndex := os.Getenv("JOB_INDEX")
	if jobIndex != "" {
		jobIndex = fmt.Sprintf("-%s", jobIndex)
		c.Name = c.NamePrefix + time.Now().Format("20060102150405") + "-" + jobIndex
	} else {
		c.Name = c.NamePrefix + time.Now().Format("20060102150405")
	}

	c.FloatingIPName = c.FloatingIpNamePrefix + time.Now().Format("20060102150405")
	return
}
