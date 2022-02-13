FROM icr.io/codeengine/golang
COPY sessions.go /go/src/
WORKDIR /go/src/
RUN go mod init main && go mod tidy && go get -d .
RUN go build -o /sessions /go/src/sessions.go
CMD /sessions
