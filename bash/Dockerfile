FROM golang:alpine

COPY server.go /
RUN GO111MODULE=off go build -o /server /server.go

FROM alpine

RUN apk update
RUN apk upgrade
RUN apk add bash curl jq git 

# Install the IBM Cloud CLI and Code Engine plugin
RUN curl -fsSL https://clis.cloud.ibm.com/install/linux | bash
RUN ln -s /usr/local/bin/ibmcloud /usr/local/bin/ic

RUN ibmcloud plugin install cloud-object-storage
RUN ibmcloud plugin install container-registry
RUN ibmcloud plugin install code-engine

COPY --from=0 server /

WORKDIR /app
COPY init /app/
COPY app /app/

CMD /server
