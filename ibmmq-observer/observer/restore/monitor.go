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

package restore

import (
	"fmt"
	"log/slog"
	"time"

	"observer/common"
	"observer/constant"
	"observer/observerrequests"
)

type Monitor struct {
	AllRegistrations *observerrequests.Registrations
}

func (m *Monitor) Start() {
	slog.Info("RestoreMonitor: Restore monitor starting up")

	sleep_interval := m.determineMonitorInterval()

	for {
		slog.Info("RestoreMonitor: Restore monitor going to sleep")
		time.Sleep(sleep_interval)

		slog.Info("RestoreMonitor: Obtaining copy of backed off registrations")
		badRegistrationsCopy := m.AllRegistrations.CopyRegistrations(common.BackedOff)

		if numReg := len(*badRegistrationsCopy); 0 < numReg {
			slog.Info(fmt.Sprintf("RestoreMonitor: There are %d registrations", numReg))
			m.processRegistrations(badRegistrationsCopy)
		}
	}
}

func (m *Monitor) processRegistrations(regs *map[string]observerrequests.RegistrationRequest) {
	slog.Info("RestoreMonitor: Restore iterating over registrations")

	for _, badReg := range *regs {
		slog.Info("RestoreMonitor: Restore Monitor checking", "registration", badReg)
		if badReg.ShouldBeReset() {
			slog.Info("RestoreMonitor: Registration backoff has expired")
			m.AllRegistrations.ResetBackoff(badReg.GetId())
		}
	}
}

func (m Monitor) determineMonitorInterval() time.Duration {
	i := constant.DetermineInterval(constant.KEY_RESTORE_INTERVAL)
	slog.Info("RestoreMonitor: Restore monitor interval override found", "minutes", i)
	return i
}
