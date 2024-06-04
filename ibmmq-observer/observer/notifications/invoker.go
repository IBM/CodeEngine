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
	"strings"
	"time"

	"log/slog"
	"net/http"

	"observer/common"
	"observer/constant"
)

type invoker struct {
	client          *http.Client
	pokerKnown      bool
	httpPoker       poker
	cloudEventPoker poker
	jobPoker        poker
}

func (i *invoker) createClient() {
	i.client = &http.Client{Timeout: 30 * time.Second}
}

// func (i *invoker) pokerDecided(eventNotifier poker) {
// 	if !i.pokerKnown {
// 		slog.Info("Invoker: Event notification implementation indentified")
// 		i.eventPoker = eventNotifier
// 		i.pokerKnown = true
// 	}
// }

func (i *invoker) getJobPoker() poker {
	slog.Info("Invoker: Retrieving Job poker")
	if nil == i.jobPoker {
		i.jobPoker = &codeEngineJobPoker{}
	}
	return i.jobPoker
}

func (i *invoker) getHttpPoker() poker {
	slog.Info("Invoker: Retrieving Http poker")
	if nil == i.client {
		i.createClient()
	}
	if nil == i.httpPoker {
		i.httpPoker = &httpPoker{client: i.client}
	}
	return i.httpPoker
}

func (i *invoker) getCloudEvent() poker {
	slog.Info("Invoker: Retrieving Cloud Event poker")
	if nil == i.cloudEventPoker {
		i.cloudEventPoker = &cloudEventsPoker{}
	}
	return i.cloudEventPoker
}

func (i *invoker) poke(url string, data map[string]string) error {
	var eventPoker poker
	pokerKnown := true
	// Check for cloud engine job
	if !strings.HasPrefix(url, "http") {
		slog.Info("Invoker: Using CodeEngine Job API as Event Notifier")
		eventPoker = i.getJobPoker()
	} else {
		// Check for cloud events as notification mechanism
		switch constant.DeterminePokerType() {
		case common.HttpEvents:
			slog.Info("Invoker: Using HTTP as Event Notifier")
			eventPoker = i.getHttpPoker()
		case common.CloudEvents:
			slog.Info("Invoker: Using CloudEvents as Event Notifier")
			eventPoker = i.getCloudEvent()
		default:
			pokerKnown = false
		}
	}

	if pokerKnown {
		return eventPoker.poke(url, data)
	}

	slog.Warn("Invoker: Event notifier not specified : Unable to send notifications")
	return fmt.Errorf("Unable to send notifications")
}

func (i invoker) runGetDepths(url string, creds common.Credentials) (*queueData, error) {
	if nil == i.client {
		i.createClient()
	}
	slog.Info("Invoker: Running queue checker")
	return queueChecker{client: i.client}.runGetDepths(url, creds)
}
