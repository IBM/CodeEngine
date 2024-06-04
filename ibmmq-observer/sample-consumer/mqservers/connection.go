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
	"strings"

	"github.com/ibm-messaging/mq-golang/v5/ibmmq"

	"consumer/configuration"
	"consumer/constant"
)

type connection struct {
	qm    *ibmmq.MQQueueManager
	queue *ibmmq.MQObject
}

func (conn *connection) createConnection(config configuration.Config, request configuration.MqRequest) error {
	slog.Info("MQ Connection: Setting up Connection to MQ")

	// Allocate the MQCNO structure needed for the CONNX call.
	cno := ibmmq.NewMQCNO()

	csp := ibmmq.NewMQCSP()
	csp.AuthenticationType = ibmmq.MQCSP_AUTH_USER_ID_AND_PWD

	user, pass := config.GetCredsFor(request.Qmgr)
	csp.UserId = user
	csp.Password = pass

	// Make the CNO refer to the CSP structure so it gets used during the connection
	cno.SecurityParms = csp

	// Need to specify the KeyRepository location
	if keystore := config.GetKeyStoreLocation(); keystore != "" {
		slog.Info("MQ Connection: using", "key store", keystore)
		sco := ibmmq.NewMQSCO()
		sco.KeyRepository = keystore
		cno.SSLConfig = sco
	}

	// Indicate that we definitely want to use the client connection method.
	cno.Options = ibmmq.MQCNO_CLIENT_BINDING
	// And now we can try to connect. Wait a short time before disconnecting.
	slog.Info("MQ Connection: attempting connection", "to", request.Qmgr)

	qMgr, err := ibmmq.Connx(request.Qmgr, cno)
	if nil != err {
		return err
	}

	slog.Info("MQ Connection: Connection succeeded")
	conn.qm = &qMgr

	return nil
}

func (conn *connection) openQueue(request configuration.MqRequest) error {
	slog.Info("MQ Connection: Opening queue")

	// Create the Object Descriptor that allows us to give the queue name
	mqod := ibmmq.NewMQOD()
	openOptions := ibmmq.MQOO_INPUT_EXCLUSIVE
	mqod.ObjectType = ibmmq.MQOT_Q
	mqod.ObjectName = request.Queue

	qObject, err := conn.qm.Open(mqod, openOptions)

	if err != nil {
		return nil
	} else {
		slog.Info("MQ Connection: Opened", "queue", qObject.Name)
		conn.queue = &qObject
	}

	return nil
}

func (conn connection) processMessages() error {
	slog.Info("MQ Connection: processing messages off queue")
	var err error
	msgAvail := true

	for msgAvail == true && err == nil {
		var datalen int

		getmqmd := ibmmq.NewMQMD()
		gmo := ibmmq.NewMQGMO()

		// The default options are OK, but it's always
		// a good idea to be explicit about transactional boundaries as
		// not all platforms behave the same way.
		gmo.Options = ibmmq.MQGMO_NO_SYNCPOINT

		// Set options to wait for any new message to arrive
		gmo.Options |= ibmmq.MQGMO_WAIT
		gmo.WaitInterval = constant.GET_WAIT_INTERVAL

		// Create a buffer for the message data. This one is large enough
		// for the messages put by the amqsput sample.
		buffer := make([]byte, 1024)

		// Now try to get the message
		datalen, err = conn.queue.Get(getmqmd, gmo, buffer)

		if err != nil {
			msgAvail = false

			mqret := err.(*ibmmq.MQReturn)
			slog.Info(fmt.Sprintf("MQ Connection: return code %d, expected %d,",
				mqret.MQRC,
				ibmmq.MQRC_NO_MSG_AVAILABLE))
			if mqret.MQRC == ibmmq.MQRC_NO_MSG_AVAILABLE {
				// If there's no message available, then don't treat that as a real error as
				// it's an expected situation
				// but do end loop
				err = nil
				slog.Info("MQ Connection: No more messages on this queue")
			}
		} else {
			// Assume the message is a printable string
			slog.Info("MQ Connection: Got message of", "length", datalen)
			msg := fmt.Sprintf(strings.TrimSpace(string(buffer[:datalen])))
			slog.Info("MQ Connection:", "message", msg)
		}
	}

	return nil
}

func (conn *connection) close() {
	if nil != conn.queue {
		conn.queue.Close(0)
	}
}

func (conn *connection) disconnect() {
	if nil != conn.qm {
		conn.qm.Disc()
	}
}
