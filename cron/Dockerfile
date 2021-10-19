FROM golang:alpine
COPY cron.go /
RUN go build -o /cron /cron.go

# Copy the exe into a smaller base image
FROM alpine
COPY --from=0 /cron /cron
CMD /cron
