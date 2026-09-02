# Stage 1: build
FROM quay.io/projectquay/golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /apiserver ./cmd/apiserver

# Stage 2: runtime
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build  /apiserver /apiserver
USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/apiserver"]
