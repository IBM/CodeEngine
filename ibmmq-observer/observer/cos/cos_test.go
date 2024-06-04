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

// Only test external interface
package cos_test

import (
	"testing"

	"observer/cos"
)

// Tests should fail with errors, and not panic
func Test_loadFailure(t *testing.T) {
	var store cos.CosStore

	if _, err := store.Load(); nil == err {
		t.Error("Cos store Load should fail with error returned")
	}

	// load should not influence how save fails
	if _, err := store.Save(nil); nil == err {
		t.Error("Cos store Load should fail with error returned")
	}
}

func Test_saveFailure(t *testing.T) {
	var store cos.CosStore

	// test save failure, when no precusor load
	if _, err := store.Save(nil); nil == err {
		t.Error("Cos store Load should fail with error returned")
	}
}
