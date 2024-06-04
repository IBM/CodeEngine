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

package observerrequests

import (
	"errors"
	"fmt"
	"io"
	"strings"
	//"reflect"
	"encoding/json"
	"log/slog"
	"net/http"

	"observer/constant"
)

// func NewRequestHandler(w http.ResponseWriter, r *http.Request) {
// 	slog.Info("RegistrationHandler: Request has been received")
// 	w.Write([]byte("Received"))
// }

type DefaultRequestHandler struct{}
type RegistrationHandler struct {
	Regs *Registrations
}

func (rh RegistrationHandler) addRegistration(newReg RegistrationRequest) {
	rh.Regs.addRegistration(newReg)
}

func (rh RegistrationHandler) dropRegistration(existingReg RegistrationRequest) {
	rh.Regs.dropRegistration(existingReg)
}

func (rh RegistrationHandler) dropAllRegistrations() int {
	return rh.Regs.dropAllRegistrations()
}

func (rh DefaultRequestHandler) Reject(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "Page not found", http.StatusNotFound)
}

func (rh DefaultRequestHandler) Acknowledge(w http.ResponseWriter, r *http.Request) {
	if http.MethodPost != r.Method {
		http.Error(w, "Unsupported", http.StatusNotFound)
		return
	}

	slog.Info("RegistrationHandler: Received notification")

	rh.inspectResponse(r)

	var ack jsonAcknowledge
	ack.Message = "Received"
	w.Header().Set("Content-Type", "application/json")

	slog.Info("RegistrationHandler: Sending acknowledgment")

	if err := json.NewEncoder(w).Encode(ack); nil != err {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(err.Error()))
	}
}

func (rh RegistrationHandler) ServeRequest(w http.ResponseWriter, r *http.Request) {
	slog.Info("RegistrationHandler: Registration request has been received")

	var err error

	verb := r.Method
	slog.Info("RegistrationHandler: Request details", "Method", verb)

	// if 0 != strings.Compare(http.MethodPost, verb) {
	// 	err = errors.Join(err, fmt.Errorf("Only listening for %s", http.MethodPost))
	// }

	//var resp string = "Not yet implemented"

	var resp jsonRequest

	switch verb {
	case http.MethodPost:
		if registrationErr := r.ParseForm(); registrationErr != nil {
			err = errors.Join(err, registrationErr)
		} else if regRequest, registrationErr := getRegistrationData(r, verb); registrationErr != nil {
			err = errors.Join(err, registrationErr)
		} else {
			rh.addRegistration(*regRequest)
			slog.Info("RegistrationHandler: Specified", constant.QMGR, regRequest.qmgr)
			slog.Info("RegistrationHandler: Specified", constant.QUEUE, regRequest.queue)
			slog.Info("RegistrationHandler: Specified", constant.NOTIFY, regRequest.notify)
			resp.set(*regRequest)
		}
	case http.MethodDelete:
		if registrationErr := r.ParseForm(); registrationErr != nil {
			err = errors.Join(err, registrationErr)
		} else if regRequest, registrationErr := getRegistrationData(r, verb); registrationErr != nil {
			err = errors.Join(err, registrationErr)
		} else {
			rh.dropRegistration(*regRequest)
			slog.Info("RegistrationHandler: Specified", constant.ID, regRequest.id)
			resp.set(*regRequest)
		}

		break
	default:
		err = errors.Join(err, fmt.Errorf("Only listening for %s and %s", http.MethodPost, http.MethodDelete))
	}

	if nil == err {
		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(resp)
	}

	if nil != err {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(err.Error()))
		return
	}

	//w.Write([]byte(resp))
}

func (rh RegistrationHandler) Flush(w http.ResponseWriter, r *http.Request) {
	slog.Info("RegistrationHandler: Flush request received")
	if http.MethodDelete != r.Method {
		slog.Info("RegistrationHandler: Unsupported", "method", r.Method)
		http.Error(w, "Unsupported", http.StatusNotFound)
		return
	}

	numDropped := rh.dropAllRegistrations()

	var ack jsonAcknowledge
	ack.Message = fmt.Sprintf("%d registrations dropped", numDropped)
	w.Header().Set("Content-Type", "application/json")

	slog.Info("RegistrationHandler: Sending acknowledgment")

	if err := json.NewEncoder(w).Encode(ack); nil != err {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(err.Error()))
	}
}

// func NewRequestHandler() http.Handler {
// 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
// 		slog.Info("RegistrationHandler: Request has been received")
// 		w.Write([]byte("Received"))
// 	})
// }

func getRegistrationData(r *http.Request, verb string) (*RegistrationRequest, error) {

	contentType := r.Header["Content-Type"]
	slog.Info("RegistrationHandler: Content is", "type", contentType)

	// rt := reflect.TypeOf(contentType)
	// slog.Info("RegistrationHandler: Content field is of", "type", rt)

	// Check if json, otherwise treat as x-www-form-urlencoded

	var regRequest RegistrationRequest
	var err error

	if strings.Contains(contentType[0], "json") {
		slog.Info("RegistrationHandler: Processing submitted data as json")
		err = regRequest.fromJson(r)
	} else {
		slog.Info("RegistrationHandler: Processing submitted data as x-www-form-urlencoded")
		regRequest.fromForm(r)
	}
	// slog.Info("RegistrationHandler: From Form", QMGR, qmgr)

	if http.MethodPost == verb {
		err = errors.Join(err, regRequest.validate())
	} else {
		err = errors.Join(err, regRequest.checkId())
	}

	if nil != err {
		return nil, err
	} else {
		return &regRequest, nil
	}
}

func (rh DefaultRequestHandler) inspectResponse(r *http.Request) {
	slog.Info("RegistrationHandler: inspecting request")
	for headerName, headerValue := range r.Header {
		slog.Info(fmt.Sprintf("\t%s = %s\n", headerName, strings.Join(headerValue, ", ")))
	}

	if reqBody, err := io.ReadAll(r.Body); nil != err {
		slog.Warn("RegistrationHandler: unable to process request body", "error", err)
	} else {
		fmt.Printf("server: request body: %s\n", reqBody)
	}
}
