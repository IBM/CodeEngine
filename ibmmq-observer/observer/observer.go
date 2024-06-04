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

package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"observer/common"
	"observer/constant"
	"observer/notifications"
	"observer/observerrequests"
	"observer/persist"
	"observer/restore"
)

func main() {
	slog.Info("Observer: Starting Observer")

	listenURL := determineListeningURL()
	slog.Info("Observer: Listening on", "URL", listenURL)

	// Set up the store of active registrations
	var activeRegistrations observerrequests.Registrations

	// Determine run mode
	runMode := constant.DetermineRunMode()

	// if running in Reservations Only no need to start the notifier,
	// nor the bad registrations monitor,
	// in all other modes the notifer and bad registrations monitor is
	// needed
	if common.ReservationsOnly != runMode {
		// Start the notifier as a go routine, giving it a link to the registation store
		notifier := notifications.Notifier{ActiveRegistrations: &activeRegistrations}
		go runNotifier(&notifier)

		// If not dropping bad registrations, then misbehaving registrations
		// will be marked with back off durations. Check if these have
		// expired
		if !constant.DropBadRegistrations() {
			monitor := restore.Monitor{AllRegistrations: &activeRegistrations}
			go runBackOffMonitor(&monitor)
		}
	}

	// Persister is needed in all modes
	// Start the persister as a go routine, giving it a link to the registration store
	persister := persist.Persister{ActiveRegistrations: &activeRegistrations}
	go runPersister(&persister)

	// Determine if there the registration store has been persisted
	if persistData, err := persister.Load(); nil == err && nil != persistData {
		activeRegistrations.DataFromStore(persistData)
	}

	// If running in notification only mode then only need
	// a single http endpoints to keep app running.
	// Reject access to /
	http.HandleFunc("/", observerrequests.DefaultRequestHandler{}.Reject)

	if common.NotifcationOnly != runMode {

		// Allow POST and DELETE to /register
		http.HandleFunc("/register", observerrequests.RegistrationHandler{Regs: &activeRegistrations}.ServeRequest)

		// Admin request to flush the cache, and hence storage of registrations
		http.HandleFunc("/admin/flush", observerrequests.RegistrationHandler{Regs: &activeRegistrations}.Flush)

		// circular uri to acknowledge self notifications during test
		http.HandleFunc("/notify", observerrequests.DefaultRequestHandler{}.Acknowledge)
	}

	// If we don't do this then the app will stop running here.
	if err := http.ListenAndServe(listenURL, nil); nil != err {
		slog.Warn("Observer: Not able to set up http listener", "error", err)
	}
}

func runNotifier(notifier *notifications.Notifier) {
	slog.Info("Observer: Starting notifier routine")
	notifier.Start()
}

func runPersister(persister *persist.Persister) {
	slog.Info("Observer: Starting persistence routine")
	persister.Start()
}

func runBackOffMonitor(monitor *restore.Monitor) {
	slog.Info("Observer: Starting monitor to restore expired backed off registrations")
	monitor.Start()
}

func determineListeningURL() string {
	listenOnPort := 8080
	if p, ok := os.LookupEnv(constant.KEY_PORT); ok {
		slog.Info("Observer: Envrionment override for", "port", p)
		return fmt.Sprintf(":%s", p)
	}
	return fmt.Sprintf(":%d", listenOnPort)
}
