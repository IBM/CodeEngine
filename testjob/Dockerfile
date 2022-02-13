FROM icr.io/codeengine/golang:alpine
COPY testjob.go /
RUN  go build -o /testjob /testjob.go

# Copy exe into a smaller image
FROM icr.io/codeengine/alpine
COPY --from=0 /testjob /testjob
CMD  /testjob
