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

package mqservers

import (
	"fmt"
	"log/slog"
	"os"
	"strings"

	"consumer/configuration"
	"consumer/constant"
)

type QueueManagers struct {
	config configuration.Config
	mqreq  *configuration.MqRequest
	mqconn connection
}

func (qms *QueueManagers) Load() error {
	slog.Info("QueueManagers: Loading list of MQ queue managers and associated app credentials")
	qms.config.LoadMQEndpoints()

	if 0 == qms.config.NumMQPoints() {
		return fmt.Errorf("QueueManagers: No queue managers found")
	}

	return nil
}

func (qms QueueManagers) CheckCCDT() error {
	if fPath, err := qms.config.CCDTPath(); nil != err {
		return err
	} else {
		ccdtFile, err := os.Open(strings.TrimPrefix(fPath, constant.FILEPREFIX))
		defer ccdtFile.Close()

		if err != nil {
			slog.Warn("QueueManagers: CCDT File not found")
			return err
		}
	}
	return nil
}

func (qms *QueueManagers) CheckIncomingRequest() error {
	if req, err := qms.config.CheckRequest(); nil != err {
		return err
	} else {
		qms.mqreq = req
	}
	return nil
}

func (qms QueueManagers) ProcessQueue() error {
	slog.Info("QueueManagers: Processing queue")

	if nil == qms.mqreq {
		return fmt.Errorf("QueueManagers: Incoming request not yet resolved")
	}

	if err := qms.mqconn.createConnection(qms.config, *qms.mqreq); nil != err {
		return err
	}
	defer qms.mqconn.disconnect()

	if err := qms.mqconn.openQueue(*qms.mqreq); nil != err {
		return err
	}
	defer qms.mqconn.close()

	if err := qms.mqconn.processMessages(); nil != err {
		return err
	}

	return nil
}
