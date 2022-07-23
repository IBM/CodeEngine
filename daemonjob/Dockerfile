FROM icr.io/codeengine/golang:alpine
COPY daemonjob.go /
RUN  go build -o /daemonjob /daemonjob.go

# Copy exe into a smaller image
FROM icr.io/codeengine/alpine
COPY --from=0 /daemonjob /daemonjob
CMD  /daemonjob
