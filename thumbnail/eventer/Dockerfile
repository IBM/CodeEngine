FROM icr.io/codeengine/golang:alpine AS bootstrap
WORKDIR /go/src/
COPY . .
RUN go build -o /eventer eventer.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=bootstrap /eventer /eventer
CMD ["/eventer"]
