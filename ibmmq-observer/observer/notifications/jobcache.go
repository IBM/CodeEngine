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
	"time"

	"log/slog"

	"observer/constant"
)

type cejob struct {
	region    string
	projectId string
	jobId     string
	name      string
}

type jobCache struct {
	cache   map[string]cejob
	goodTil time.Time
}

func (jc *jobCache) flush() {
	jc.cache = make(map[string]cejob)
}

func (jc *jobCache) add(region string, jobName string, jobId string, projectId string) {
	if nil == jc.cache {
		jc.flush()
	}
	jc.cache[jobName] = cejob{projectId: projectId,
		jobId:  jobId,
		name:   jobName,
		region: region,
	}
}

func (jc jobCache) size() int {
	if nil == jc.cache {
		return 0
	}
	return len(jc.cache)
}

func (jc jobCache) find(jobName string) (cejob, bool) {
	if nil == jc.cache {
		return cejob{}, false
	} else {
		job, ok := jc.cache[jobName]
		return job, ok
	}
}

func (jc *jobCache) setGoodTil() {
	jc.goodTil = time.Now().Add(constant.DetermineInterval(constant.KEY_CODEENGINE_REFRESH_DURATION))
}

func (jc jobCache) shouldBeUpdated() bool {
	slog.Info("JobCache: checking if should be updated")

	if 0 == jc.size() ||
		(!jc.goodTil.IsZero() && time.Now().After(jc.goodTil)) {
		slog.Info("JobCache: needs updating")
		return true
	}

	slog.Info("JobCache: is fine for now")
	return false
}
