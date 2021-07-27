FROM icr.io/codeengine/golang:alpine
COPY eventer.go /go/src/
WORKDIR /go/src/
ENV GO111MODULE=off
RUN apk update && apk add git
RUN go get -d .
RUN go build -o /eventer eventer.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /eventer /eventer
CMD /eventer
