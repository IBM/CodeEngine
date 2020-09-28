FROM golang:alpine
COPY app-n-job.go /
RUN go build -o /app-n-job /app-n-job.go

# Copy the exe into a smaller base image
FROM alpine
COPY --from=0 /app-n-job /app-n-job
CMD /app-n-job
