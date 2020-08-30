FROM golang
COPY sessions.go /src/sessions.go
WORKDIR /src/
RUN go get -d ./...
RUN go build -o /sessions /src/sessions.go
CMD /sessions
