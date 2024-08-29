FROM icr.io/codeengine/golang
WORKDIR /go/src/
COPY . .
RUN go build -o /sessions /go/src/sessions.go
CMD ["/sessions"]
