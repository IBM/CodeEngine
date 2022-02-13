FROM icr.io/codeengine/golang:alpine
COPY cronjob.go /
RUN go build -o /cronjob /cronjob.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /cronjob /cronjob
CMD /cronjob
