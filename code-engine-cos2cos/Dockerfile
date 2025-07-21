FROM quay.io/projectquay/golang:1.23 AS builder
WORKDIR /go/src/app

COPY . .

RUN go mod tidy

# Build the Go application for Linux, stripped of debug information
RUN CGO_ENABLED=0 GOOS=linux go build -o cos2cos

# Stage 2: Final stage (minimal image)
FROM gcr.io/distroless/static-debian12

# Copy the binary from the builder stage
COPY --from=builder /go/src/app/cos2cos /

ENTRYPOINT ["/cos2cos"]