FROM icr.io/codeengine/golang:alpine
COPY config.go /
RUN go build -o /config /config.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /config /config
CMD /config
