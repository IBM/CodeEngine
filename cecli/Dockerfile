FROM quay.io/projectquay/golang:1.23 AS build-env
WORKDIR /go/src/app
COPY . .

RUN CGO_ENABLED=0 go build -o /go/bin/app cecli.go

# Copy the exe into a non-golang image
FROM quay.io/centos/centos:stream9

# Install the IBM Cloud CLI and Code Engine plugin
RUN dnf install yum && yum update -y
RUN curl -fsSL https://clis.cloud.ibm.com/install/linux | sh
RUN ibmcloud plugin install code-engine

COPY --from=0 /go/bin/app /
CMD ["/app"]
