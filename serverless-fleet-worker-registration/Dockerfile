# Stage 1: Build stage
FROM quay.io/projectquay/golang:1.25 AS builder

# Set working directory
WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY main.go ./

# Build the application
# CGO_ENABLED=0 for static binary
# -ldflags="-w -s" to reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o fleet-register .

# Stage 2: Runtime stage
FROM registry.access.redhat.com/ubi10/ubi-minimal

# Copy binary from builder
COPY --from=builder /build/fleet-register /app/fleet-register

# Set working directory
WORKDIR /app

# Expose port
EXPOSE 8080

RUN mkdir /fleet-workers

# Set environment variable for the workbook path
ENV WORKBOOK_PATH=/fleet-workers/fleet-register.xlsx

# Run the application
CMD ["/app/fleet-register"]