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

package constant

import (
	"os"
	"strconv"
	"strings"
	"time"

	"observer/common"
)

const ID = "ID"
const QMGR = "QMGR"
const QUEUE = "QUEUE"
const NOTIFY = "NOTIFY"

const CE_QMGR = "CE_QMGR"
const CE_QUEUE = "CE_QUEUE"
const QUEUE_DEPTH = "CE_DEPTH"

const MAX_MQ_POINTS = 20

// These key values can be used to override values used
// in the observer application
// Lowercase names are not exported.
const KEY_ENV_FILE = "EnvFile"
const KEY_PORT = "PORT"

const KEY_NOTIFY_SLEEP_INTERVAL = "NOTIFY_INTERVAL"
const KEY_PERSIST_INTERVAL = "PERSIST_INTERVAL"
const KEY_RESTORE_INTERVAL = "RESTORE_INTERVAL"
const KEY_BACKOFF_DURATION = "BACKOFF_DURATION"
const KEY_CODEENGINE_REFRESH_DURATION = "CE_REFRESH_INTERVAL"

const key_running_test_mode = "TEST"
const key_drop_bad = "DROP_BAD"

const key_no_cos = "NO_COS"
const use_cos_storage = true

const key_http_poker = "HTTP_NOTIFY"
const key_cloudevent_poker = "CLOUD_EVENTS"
const use_cloudevents = true

const key_enable_reservations = "ENABLE_RESERVATIONS"
const key_enable_notifications = "ENABLE_NOTIFICATIONS"
const key_enable_all = "ENABLE_ALL"

// Keys to retrieve MQ instances
const KEY_ADMIN_USER = "ADMIN_USER"
const KEY_ADMIN_PASSWORD = "ADMIN_PASSWORD"
const KEY_QMGR = "QMGR"
const KEY_MQ_HOST = "MQ_REST_HOST"
const KEY_MQ_PORT = "MQ_REST_PORT"

// Keys for COS persist of registrations
const KEY_COS_STORAGE = "COS_STORAGE"
const KEY_COS_BUCKET = "bucket"
const KEY_COS_APIKEY = "cos_apikey"
const KEY_COS_ENDPOINTS = "endpoints"
const KEY_COS_INSTANCE_ID = "resource_instance_id"
const KEY_COS_AUTH_ENDPOINT = "auth_endpoint"

const DEFAULT_COS_AUTH_ENDPOINT = "https://iam.cloud.ibm.com/identity/token"

// Keys for Cloud Engine API
const KEY_CE_APIKEY = "ce_apikey"
const KEY_CE_AUTH_ENDPOINT = "auth_endpoint"
const KEY_CE_CLIENT_ID = "client_id"
const KEY_CE_SECRET = "client_secret"

// const KEY_CE_REGION = "region"
const KEY_CE_REGIONS = "regions"

const KEY_REG_SEED_DATA = "seeddata"

const DEFAULT_CLIENT_ID = "bx"
const DEFAULT_CLIENT_SECRET = "bx"
const DEFAULT_CE_AUTH_ENDPOINT = "https://iam.cloud.ibm.com"

// CloudEvents related constants
const CLOUDEVENT_SOURCE = "mq-observer"
const CLOUDEVENT_TYPE = "queue-messages"

// default timings, under normal and development runnings.
const default_sleep_interval = 5 * time.Minute

// ***
const default_test_sleep_interval = 30 * time.Second

//const default_test_sleep_interval = 2 * time.Minute

const default_persist_interval = 10 * time.Minute

// ***
const default_test_persist_interval = 2 * time.Minute

//const default_test_persist_interval = 30 * time.Second

const default_restore_monitor_interval = 1 * time.Hour
const default_test_restore_monitor_interval = 3 * time.Minute

const default_fail_tolerance = 10
const default_test_fail_tolerance = 2

const default_backoff_duration = 24 * time.Hour
const default_test_backoff_duration = 4 * time.Minute

const default_test_ce_refresh_duration = 5 * time.Minute
const default_ce_refresh_duration = 10 * time.Minute

const drop_bad_registrations = false

const MAX_NOSTORE_ITERATIONS = 2 // 10

const DEFAULT_ENV_FILE = "./env.json"

const MQ_QUERY_CONSTRUCT = "/ibmmq/rest/v1/admin/qmgr/"
const MQ_QUERY_PARAMS = "?status=status.currentDepth"

func DetermineInterval(key string) time.Duration {
	key = strings.ToUpper(key)
	_, runningInTest := os.LookupEnv(key_running_test_mode)

	if s, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(s); nil == err {
			return time.Duration(i) * time.Minute
		}
	}

	switch key {
	case KEY_PERSIST_INTERVAL:
		if runningInTest {
			return default_test_persist_interval
		} else {
			return default_persist_interval
		}
	case KEY_RESTORE_INTERVAL:
		if runningInTest {
			return default_test_restore_monitor_interval
		} else {
			return default_restore_monitor_interval
		}
	case KEY_BACKOFF_DURATION:
		if runningInTest {
			return default_test_backoff_duration
		} else {
			return default_backoff_duration
		}
	case KEY_CODEENGINE_REFRESH_DURATION:
		if runningInTest {
			return default_test_ce_refresh_duration
		} else {
			return default_ce_refresh_duration
		}
	}

	if runningInTest {
		return default_test_sleep_interval
	} else {
		return default_sleep_interval
	}
}

func DropBadRegistrations() bool {
	if 0 < len(os.Getenv(key_drop_bad)) {
		return true
	} else {
		return drop_bad_registrations
	}
}

func UseCOSStorage() bool {
	if 0 < len(os.Getenv(key_no_cos)) {
		return false
	} else {
		return use_cos_storage
	}
}

func DetermineRunMode() common.RunMode {
	enableHttp := (0 < len(os.Getenv(key_enable_reservations)))
	enableNotifications := (0 < len(os.Getenv(key_enable_notifications)))
	//enableAll := (0 < len(os.Getenv(key_enable_all)))

	if enableHttp && !enableNotifications {
		return common.ReservationsOnly
	} else if !enableHttp && enableNotifications {
		return common.NotifcationOnly
	}

	//Default to combined mode
	return common.AllFunctions
}

func DeterminePokerType() common.NotificationPoker {
	// If requested CloudEvents overrides
	// https://cloudevents.io
	if 0 < len(os.Getenv(key_cloudevent_poker)) {
		return common.CloudEvents
	} else if 0 < len(os.Getenv(key_http_poker)) {
		return common.HttpEvents
	} else if use_cloudevents {
		// check compile time constants for cloudevents
		return common.CloudEvents
	}

	// Default to HTTP if nothing explicit is requested
	return common.HttpEvents
}

func IsFailureExcessive(fails int) bool {
	tolerance := default_fail_tolerance
	if _, runningInTest := os.LookupEnv(key_running_test_mode); runningInTest {
		tolerance = default_test_fail_tolerance
	}
	return tolerance <= fails
}

func FailTolerance() int {
	tolerance := default_fail_tolerance
	if _, runningInTest := os.LookupEnv(key_running_test_mode); runningInTest {
		tolerance = default_test_fail_tolerance
	}
	return tolerance
}
