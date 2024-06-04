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
	"context"
	"fmt"

	"log/slog"

	"observer/constant"

	cloudevents "github.com/cloudevents/sdk-go/v2"
)

type cloudEventsPoker struct {
	client *cloudevents.Client
}

func (cep *cloudEventsPoker) createClient() error {
	if nil == cep.client {
		client, err := cloudevents.NewClientHTTP()
		if err != nil {
			slog.Info("CloudEventsPoker: Failed to create client", "error", err)
			return fmt.Errorf("failed to create client, %v", err)
		}
		cep.client = &client
	}
	return nil
}

func (cep *cloudEventsPoker) poke(url string, data map[string]string) error {
	slog.Info("CloudEventsPoker: Building cloud event")

	if err := cep.createClient(); nil != err {
		return err
	}

	event := cloudevents.NewEvent()
	event.SetSource(constant.CLOUDEVENT_SOURCE)
	event.SetType(constant.CLOUDEVENT_TYPE)

	event.SetData(cloudevents.ApplicationJSON, data)

	ctx := cloudevents.ContextWithTarget(context.Background(), url)

	// Send that Event.
	if result := (*cep.client).Send(ctx, event); cloudevents.IsUndelivered(result) {
		return fmt.Errorf("failed to send, %v", result)
	} else if cloudevents.IsNACK(result) {
		slog.Warn("CloudEventsPoker: error sending event", "error", result)
		return result
	} else {
		slog.Info(fmt.Sprintf("CloudEventsPoker: sent: %v", event))
		slog.Info(fmt.Sprintf("CloudEventsPoker: result: %v", result))

	}

	return nil
}
