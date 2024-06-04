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
	"strings"
)

type alreadyViewedCache struct {
	cache map[string]queueData
}

func (c *alreadyViewedCache) flush() {
	c.cache = make(map[string]queueData)
}

func (c *alreadyViewedCache) add(qmgr string, qd queueData) {
	if nil == c.cache {
		c.flush()
	}
	c.cache[qmgr] = qd
}

func (c alreadyViewedCache) len() int {
	return len(c.cache)
}

func (c alreadyViewedCache) checkFor(qmgr string) bool {
	_, ok := c.cache[qmgr]
	return ok
}

func (c alreadyViewedCache) queueDepthFor(qmgr string, queue string) int {
	if qd, ok := c.cache[qmgr]; ok {
		for _, qi := range qd.Queue {
			if 0 == strings.Compare(qi.Name, queue) {
				return qi.Status.CurrentDepth
			}
		}
	}
	return 0
}

func (c alreadyViewedCache) queueMatch(qmgr string, queue string) bool {
	if qd, ok := c.cache[qmgr]; ok {
		for _, qi := range qd.Queue {
			if 0 == strings.Compare(qi.Name, queue) {
				return true
			}
		}
	}
	return false
}
