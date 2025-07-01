# FROM golang:1.23-alpine as builder

# WORKDIR /app

# COPY go.mod go.sum ./

# RUN go mod tidy

# COPY . .

# # Build the Go application for Linux, stripped of debug information
# RUN CGO_ENABLED=0 GOOS=linux go build -o cos2cos

# # Stage 2: Final stage (minimal image)
# FROM alpine

# RUN apk --no-cache add ca-certificates


# # Copy the binary from the builder stage
# COPY --from=builder /app/cos2cos /

# RUN chmod +x /cos2cos

# ENTRYPOINT ["/cos2cos"]


FROM quay.io/projectquay/golang:1.23 AS builder
WORKDIR /go/src/app

COPY . .

RUN go mod tidy

# Build the Go application for Linux, stripped of debug information
RUN CGO_ENABLED=0 GOOS=linux go build -o cos2cos

# Stage 2: Final stage (minimal image)
FROM gcr.io/distroless/static-debian12

# RUN apk --no-cache add ca-certificates


# Copy the binary from the builder stage
COPY --from=builder /go/src/app/cos2cos /

ENTRYPOINT ["/cos2cos"]