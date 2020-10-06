FROM golang:alpine
COPY ping.go /
RUN go build -o /ping /ping.go

# Copy the exe into a smaller base image
FROM alpine
COPY --from=0 /ping /ping
CMD /ping
