# Build context: this directory (see ../../build)
FROM golang:1.27.3-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/webhook-consumer .

FROM scratch
# CA certificates for the TLS connections to IAM and COS
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/webhook-consumer /webhook-consumer
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/webhook-consumer"]
