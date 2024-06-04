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
	"testing"

	"net/http"
	"net/http/httptest"

	"observer/common"
	"observer/constant"
)

func Test_httpInvoker(t *testing.T) {
	var i invoker

	// Key is private to constant
	// t.Setenv(constant.key_http_poker, "Y")
	t.Setenv("HTTP_NOTIFY", "Y")

	if pokerType := constant.DeterminePokerType(); common.HttpEvents != pokerType {
		t.Fatal("Expecting poker type to be HttpEvents")
	}

	if nil != i.client {
		t.Error("http client should still be null")
	}

	i.createClient()
	if nil == i.client {
		t.Error("http client should have been created")
	}

	url := "http//"
	data := map[string]string{constant.QMGR: "QM1", constant.QUEUE: "DEV.QUEUE.1"}

	if err := i.poke(url, data); nil == err {
		t.Error("expecting error to be thrown when invoking http poke")
	}

	server := httptest.NewServer(
		http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			rw.WriteHeader(http.StatusOK)
		}))

	url = server.URL
	if err := i.poke(url, data); nil != err {
		t.Errorf("Unexpected error thrown when invoking http poker%v", err)
	}
}

func Test_cloudEventInvoker(t *testing.T) {
	var i invoker

	// Default is Cloud Event
	if pokerType := constant.DeterminePokerType(); common.CloudEvents != pokerType {
		t.Fatal("Expecting poker type to be CloudEvents")
	}

	if nil != i.client {
		t.Error("http client should still be null")
	}

	i.createClient()
	if nil == i.client {
		t.Error("http client should have been created")
	}

	url := "http//"
	data := map[string]string{constant.QMGR: "QM1", constant.QUEUE: "DEV.QUEUE.1"}

	if err := i.poke(url, data); nil == err {
		t.Error("expecting error to be thrown when invoking http poke")
	}

	server := httptest.NewServer(
		http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			rw.WriteHeader(http.StatusOK)
		}))

	url = server.URL
	if err := i.poke(url, data); nil != err {
		t.Errorf("Unexpected error thrown when invoking http poker%v", err)
	}
}

func Test_codeEngineInvoker(t *testing.T) {
	var i invoker

	url := "badJob"
	data := map[string]string{constant.QMGR: "QM1", constant.QUEUE: "DEV.QUEUE.1"}

	if err := i.poke(url, data); nil == err {
		t.Error("expecting error to be thrown when invoking code engine poke")
	}

	if err := i.poke(url, data); nil == err {
		t.Error("expecting error to be thrown when invoking code engine poke")
	}
}
