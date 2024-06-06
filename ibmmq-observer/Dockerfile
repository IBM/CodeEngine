#  Copyright 2024 IBM Corp.
#  Licensed under the Apache License, Version 2.0 (the 'License');
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
 
#  http://www.apache.org/licenses/LICENSE-2.0
 
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

###########################################################
# This starts the BUILD phase
###########################################################
# FROM --platform=linux/amd64 golang:1.22 as builder
# FROM --platform=linux/arm64 golang:1.22 as builder
ARG arch=amd64

FROM --platform=linux/${arch} golang:1.22-alpine as builder

ENV APP_DIR /usr/src
WORKDIR ${APP_DIR}

COPY ./observer ./observer
WORKDIR ${APP_DIR}/observer

RUN rm observer || true 
RUN go mod download
RUN go build


###########################################################
# This starts the RUNTIME phase
###########################################################
FROM --platform=linux/${arch} golang:1.22-alpine 

ENV APP_DIR /usr/src/observer
WORKDIR ${APP_DIR}

# Copy over just the application
# and the environment file only
COPY --from=builder ${APP_DIR}/observer ${APP_DIR}/observer
COPY --from=builder ${APP_DIR}/env.json ${APP_DIR}/env.json

EXPOSE 8080

CMD ["./observer"]
