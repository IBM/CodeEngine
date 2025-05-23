FROM  golang:1.23


# Build the application from source
FROM --platform=linux/amd64 golang:1.23 AS build-stage

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

RUN CGO_ENABLED=0 GOOS=linux go build -o /api


# Deploy the application binary into a lean image
FROM --platform=linux/amd64 alpine



WORKDIR /

RUN mkdir images
COPY --from=build-stage /api /api


EXPOSE 8080


ENTRYPOINT ["/api"]