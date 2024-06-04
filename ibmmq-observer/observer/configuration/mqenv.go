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
	"fmt"

	"observer/common"
	"observer/constant"
)

type mqenv struct {
	MQHost   string `json:"MQ_REST_HOST"`
	MQPort   string `json:"MQ_REST_PORT"`
	User     string `json:"ADMIN_USER"`
	Password string `json:"ADMIN_PASSWORD"`
	Qmgr     string `json:"QMGR"`
	//Queue    string `json:"QUEUE_NAME"`
}

func (env mqenv) buildURL() (string, common.Credentials) {
	return fmt.Sprintf("%s:%s%s%s/queue%s",
		env.MQHost, env.MQPort,
		constant.MQ_QUERY_CONSTRUCT,
		env.Qmgr,
		constant.MQ_QUERY_PARAMS), common.Credentials{User: env.User, Pass: env.Password}
}
