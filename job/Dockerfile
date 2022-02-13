FROM icr.io/codeengine/golang:alpine
COPY job.go /
RUN  go build -o /job /job.go

# Copy exe into a smaller image
FROM icr.io/codeengine/alpine
COPY --from=0 /job /job
CMD  /job
