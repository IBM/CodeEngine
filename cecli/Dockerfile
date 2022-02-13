FROM icr.io/codeengine/golang
COPY cecli.go /
RUN go build -o /cecli /cecli.go

# Copy the exe into a non-golang image
FROM icr.io/codeengine/ubuntu
RUN apt-get update -y && apt-get install -y curl
WORKDIR /root
# Install the IBM Cloud CLI and Code Engine plugin
RUN curl -sL https://raw.githubusercontent.com/IBM-Cloud/ibm-cloud-developer-tools/master/linux-installer/idt-installer | bash
RUN ibmcloud plugin install code-engine
COPY --from=0 /cecli /cecli
CMD /cecli
