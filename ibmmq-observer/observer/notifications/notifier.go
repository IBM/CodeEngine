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

package notifications

import (
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"observer/common"
	"observer/constant"
	"observer/mqservers"
	"observer/observerrequests"
)

type Notifier struct {
	ActiveRegistrations *observerrequests.Registrations
	qms                 mqservers.QueueManagers
	invoke              invoker
}

// func (n *Notifier) Registrations(registrations *observerrequests.Registrations) {
// 	slog.Info("Notifier: Notifier receiving registations structure")
// 	n.ActiveRegistrations = registrations
// }

func (n *Notifier) Start() {
	slog.Info("Notifier: Notifer starting up")

	n.qms.Load()

	sleep_interval := n.determineSleepInterval()

	for {
		slog.Info("Notifier: Notifier going to sleep")
		time.Sleep(sleep_interval)

		// cache := make(map[string]queueData)
		var cache alreadyViewedCache
		cache.flush()

		slog.Info("Notifier: Notifier looking for active registrations")
		regCopy := n.ActiveRegistrations.CopyRegistrations(common.Active)

		if numReg := len(*regCopy); 0 < numReg {
			slog.Info(fmt.Sprintf("Notifier: There are %d registrations", numReg))
			n.processRegistrations(regCopy, &cache)
		}
	}
}

func (n *Notifier) processRegistrations(regs *map[string]observerrequests.RegistrationRequest,
	cache *alreadyViewedCache) {
	slog.Info("Notifier: Notifier iterating over registrations")

	for _, registration := range *regs {
		slog.Info("Notifier: Checking", "registration", registration)
		required := n.checkIfNotificationRequired(cache, registration)
		slog.Info("Notifier: Notification", "required", required)
		if !required {
			continue
		}
		url := registration.GetNotify()
		data := registration.AsTransformedMap()

		// Add queue depth to output
		depth := cache.queueDepthFor(registration.GetQmgr(), registration.GetQueue())
		data[constant.QUEUE_DEPTH] = strconv.Itoa(depth)

		slog.Info("Notifier: Will send notification", "to", url)
		if err := n.invoke.poke(url, data); nil != err {
			slog.Warn("Notifier: Error sending notification", "to", url)
			slog.Warn("Notifier: Checking if registration should be dropped", "registration", registration.GetId())
			n.ActiveRegistrations.SignalFail(registration.GetId())
		}
	}
}

func (n Notifier) determineSleepInterval() time.Duration {
	i := constant.DetermineInterval(constant.KEY_NOTIFY_SLEEP_INTERVAL)
	slog.Info("Notifier: Sleep interval override found", "interval", i)
	return i
}

func (n Notifier) checkIfNotificationRequired(cache *alreadyViewedCache, regReq observerrequests.RegistrationRequest) bool {
	slog.Info("Notifier: Cache has", "entries", cache.len())

	if !cache.checkFor(regReq.GetQmgr()) {
		slog.Info("Notifier: QM not found in cache")
		qd, err := n.checkForMatchingObserver(regReq.GetQmgr(), regReq.GetQueue())
		if nil != err {
			slog.Warn("Notifier: Error checking depths", "error", err)
			return false
		}

		//(*cache)[regReq.GetQmgr()] = *qd
		cache.add(regReq.GetQmgr(), *qd)
	}

	return cache.queueMatch(regReq.GetQmgr(), regReq.GetQueue())
}

func (n Notifier) checkForMatchingObserver(qmgr string, queue string) (*queueData, error) {
	slog.Info("Notifier: Checking for registration ",
		"QMGR", qmgr,
		"QUEUE", queue)

	url, creds := n.qms.BuildURLFor(qmgr)

	slog.Info("Notifier: Will be checking", "url", url)
	return n.invoke.runGetDepths(url, creds)
}
