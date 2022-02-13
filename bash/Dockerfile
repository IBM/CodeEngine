FROM icr.io/codeengine/golang:alpine

COPY server.go /
RUN GO111MODULE=off go build -o /server /server.go

FROM icr.io/codeengine/alpine

# Upgrade the OS, install some common tools
# Install the IBM Cloud CLI and Code Engine plugin

RUN apk update && apk upgrade && apk add bash curl jq git ncurses && \
    curl -fsSL https://clis.cloud.ibm.com/install/linux | bash && \
    ln -s /usr/local/bin/ibmcloud /usr/local/bin/ic && \
    ibmcloud plugin install cloud-object-storage && \
    ibmcloud plugin install container-registry && \
    ibmcloud plugin install code-engine

ENV TERM=vt100
COPY --from=0 server /

WORKDIR /app
COPY init /app/
COPY app /app/

CMD /server
