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
	"testing"
	"time"

	"observer/common"
)

func Test_defaultIntervals(t *testing.T) {
	resultCheck := map[string]time.Duration{
		KEY_NOTIFY_SLEEP_INTERVAL: default_sleep_interval,
		KEY_PERSIST_INTERVAL:      default_persist_interval,
		KEY_RESTORE_INTERVAL:      default_restore_monitor_interval,
		KEY_BACKOFF_DURATION:      default_backoff_duration,
	}

	if resultCheck[KEY_NOTIFY_SLEEP_INTERVAL] != default_sleep_interval {
		t.Fatal("test map failing")
	}

	for key, checkInterval := range resultCheck {
		if interval := DetermineInterval(key); interval != checkInterval {
			t.Errorf("incorrect interval for %s: expected %s, got %s", key, checkInterval, interval)
		}
	}
}

func Test_defaultTestIntervals(t *testing.T) {
	t.Setenv(key_running_test_mode, "Y")

	resultCheck := map[string]time.Duration{
		KEY_NOTIFY_SLEEP_INTERVAL: default_test_sleep_interval,
		KEY_PERSIST_INTERVAL:      default_test_persist_interval,
		KEY_RESTORE_INTERVAL:      default_test_restore_monitor_interval,
		KEY_BACKOFF_DURATION:      default_test_backoff_duration,
	}

	if resultCheck[KEY_NOTIFY_SLEEP_INTERVAL] != default_test_sleep_interval {
		t.Fatal("test map failing")
	}

	for key, checkInterval := range resultCheck {
		if interval := DetermineInterval(key); interval != checkInterval {
			t.Errorf("incorrect interval for %s: expected %s, got %s", key, checkInterval, interval)
		}
	}
}

func Test_environmentOverriddenIntervals(t *testing.T) {
	t.Setenv(key_running_test_mode, "Y")
	t.Setenv(KEY_NOTIFY_SLEEP_INTERVAL, "1")
	t.Setenv(KEY_PERSIST_INTERVAL, "20")
	t.Setenv(KEY_RESTORE_INTERVAL, "300")
	t.Setenv(KEY_CODEENGINE_REFRESH_DURATION, "40")
	t.Setenv(KEY_BACKOFF_DURATION, "5000")

	resultCheck := map[string]time.Duration{
		KEY_NOTIFY_SLEEP_INTERVAL:       1 * time.Minute,
		KEY_PERSIST_INTERVAL:            20 * time.Minute,
		KEY_RESTORE_INTERVAL:            300 * time.Minute,
		KEY_CODEENGINE_REFRESH_DURATION: 40 * time.Minute,
		KEY_BACKOFF_DURATION:            5000 * time.Minute,
	}

	if resultCheck[KEY_NOTIFY_SLEEP_INTERVAL] != 1*time.Minute {
		t.Fatal("test map failing")
	}

	for key, checkInterval := range resultCheck {
		if interval := DetermineInterval(key); interval != checkInterval {
			t.Errorf("incorrect interval for %s: expected %s, got %s", key, checkInterval, interval)
		}
	}
}

func Test_defaultFailBoundaries(t *testing.T) {
	lowFail := default_fail_tolerance - 1
	highFail := default_fail_tolerance

	if tolerance := FailTolerance(); tolerance != default_fail_tolerance {
		t.Errorf("incorrect default fail tolerance expected %d, got %d", default_fail_tolerance, tolerance)
	}

	if IsFailureExcessive(lowFail) {
		t.Errorf("%d should not register has excessive failures checking against %d", lowFail, default_fail_tolerance)
	}

	if !IsFailureExcessive(highFail) {
		t.Errorf("%d should register has excessive failures checking against %d", highFail, default_fail_tolerance)
	}
}

func Test_testingFailBoundaries(t *testing.T) {
	lowFail := default_test_fail_tolerance - 1
	highFail := default_test_fail_tolerance

	t.Setenv(key_running_test_mode, "Y")

	if tolerance := FailTolerance(); tolerance != default_test_fail_tolerance {
		t.Errorf("incorrect test fail tolerance expected %d, got %d", default_test_fail_tolerance, tolerance)
	}

	if IsFailureExcessive(lowFail) {
		t.Errorf("%d should not register has excessive failures checking against %d", lowFail, default_test_fail_tolerance)
	}

	if !IsFailureExcessive(highFail) {
		t.Errorf("%d should register has excessive failures checking against %d", highFail, default_test_fail_tolerance)
	}
}

func Test_testingPokerCheck(t *testing.T) {
	if pokerType := DeterminePokerType(); common.CloudEvents != pokerType {
		if use_cloudevents {
			t.Error("Notification poker type should default to CloudEvents")
		}
	}

	t.Setenv(key_http_poker, "Y")
	if pokerType := DeterminePokerType(); common.HttpEvents != pokerType {
		if use_cloudevents {
			t.Error("Notification poker type should have been set to HttpEvents")
		}
	}

	t.Setenv(key_cloudevent_poker, "Y")
	if pokerType := DeterminePokerType(); common.CloudEvents != pokerType {
		if use_cloudevents {
			t.Error("Cloud event setting should trump http event setting")
		}
	}

}

func Test_runMode(t *testing.T) {
	if mode := DetermineRunMode(); common.AllFunctions != mode {
		t.Errorf("Run mode: wrong default mode of %d, got %d", common.AllFunctions, mode)
	}

	t.Setenv(key_enable_reservations, "Y")
	if mode := DetermineRunMode(); common.ReservationsOnly != mode {
		t.Errorf("Run mode: wrong reservations mode of %d, got %d", common.ReservationsOnly, mode)
	}

	t.Setenv(key_enable_notifications, "Y")
	if mode := DetermineRunMode(); common.AllFunctions != mode {
		t.Errorf("Run mode: wrong all functions mode mode of %d, got %d", common.AllFunctions, mode)
	}

	os.Unsetenv(key_enable_reservations)
	if mode := DetermineRunMode(); common.NotifcationOnly != mode {
		t.Errorf("Run mode: wrong notifications mode of %d, got %d", common.NotifcationOnly, mode)
	}
}
