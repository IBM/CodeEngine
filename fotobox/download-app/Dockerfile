FROM  registry.access.redhat.com/ubi9/go-toolset:1.24 AS build-stage

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

RUN CGO_ENABLED=0 GOOS=linux go build -o /api


# Deploy the application binary into a lean image
FROM gcr.io/distroless/static:latest

WORKDIR /

COPY --from=build-stage /api /api

EXPOSE 8080

ENTRYPOINT ["/api"]
