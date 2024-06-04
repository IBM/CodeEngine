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

const KEY_ENV_FILE = "EnvFile"
const DEFAULT_ENV_FILE = "./env.json"

// Keys to retrieve MQ instances
const KEY_APP_USER = "APP_USER"
const KEY_APP_PASSWORD = "APP_PASSWORD"
const KEY_QMGR = "QMGR"

const MAX_MQ_POINTS = 20

const KEY_CCDT = "MQCCDTURL"
const FILEPREFIX = "file://"
const DEFAULT_CCDT_PATH = "./ccdt.json"

const KEY_REQUEST_QMGR = "CE_QMGR"
const KEY_REQUEST_QUEUE = "CE_QUEUE"
const KEY_REQUEST_DEPTH = "CE_DEPTH"

const KEY_KEY_STORE = "KeyStore"
const DEFAULT_KEY_STORE = "./keys/qmgrcert.pem"

// 3 Seconds
const GET_WAIT_INTERVAL = 3000
