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
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

var configFilePath string

func init() {
	flag.StringVar(
		&configFilePath,
		"config",
		"",
		"The path to the JSON configuration file (required)",
	)

	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Usage: ./%s [options]\n\nOptions:\n", filepath.Base(os.Args[0]))
		flag.PrintDefaults()
		fmt.Fprint(flag.CommandLine.Output(), "\nEnvironment variables:\n IBMCLOUD_API_KEY\n\tAPI Key used for authorization against IBM Cloud services (required)\n")
	}
}

func main() {
	flag.Parse()

	if configFilePath == "" {
		flag.Usage()
		os.Exit(2)
	}

	apiKey := os.Getenv("IBMCLOUD_API_KEY")
	if apiKey == "" {
		flag.Usage()
		os.Exit(2)
	}

	conf, err := ReadFromPath(configFilePath)
	if err != nil {
		log.Fatalf("Error while fetching config: %s", err)
	}

	err = ExecuteJob(apiKey, conf)
	if err != nil {
		log.Fatalf("Error while executing VSI Job: %s", err)
	}
}
