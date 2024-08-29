FROM quay.io/centos/centos:stream9 AS build
RUN \
  yum --assumeyes --nodocs install go-toolset openssh-clients git && \
  yum clean all && \
  rm -rf /var/cache/yum

ARG GO111MODULE="on"
ENV GO111MODULE $GO111MODULE
USER root

WORKDIR /tmp/build
# First, download dependencies so we can cache this layer
COPY go.mod .
COPY go.sum .
COPY internal/*.go .

RUN if [ "${GO111MODULE}" = "on" ]; then go mod download; fi

# Copy the rest of the source code and build
COPY . .

ENV GOOS=linux
ENV GOARCH=amd64
ARG PROGRAM="vsi-proxy"

ENV CGO_ENABLED=0


RUN mkdir -p /etc/vsi-proxy/config
RUN mkdir -p /etc/vsi-proxy/templates

RUN cp -p internal/cloud-config-template.tmpl /etc/vsi-proxy/templates/

# Display Go version and build
RUN go version && \
  go build \
  -a \
  -tags timetzdata,netgo,osusergo \
  -ldflags='-extldflags "-static"' \
  -o "${PROGRAM}" \
  ./*.go && ls
RUN cp -p "${PROGRAM}" /usr/bin/vsi-proxy

# Multi stage build
FROM registry.access.redhat.com/ubi8/ubi-minimal:latest
USER 0
RUN mkdir -p /etc/vsi-proxy/config
RUN mkdir -p /opt/vsi-proxy/templates
RUN mkdir -p /opt/vsi-proxy/generated
WORKDIR /opt/vsi-proxy
COPY --from=build /usr/bin/vsi-proxy /opt/vsi-proxy/vsi-proxy
COPY --from=build /etc/vsi-proxy/templates/cloud-config-template.tmpl /opt/vsi-proxy/templates/cloud-config-template.tmpl
ENTRYPOINT [ "/opt/vsi-proxy/vsi-proxy", "-config", "/etc/vsi-proxy/config/vsi-proxy-config.yaml" ]
