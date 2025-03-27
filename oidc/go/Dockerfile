FROM quay.io/projectquay/golang:1.22 AS build-env
WORKDIR /go/src/app
COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /go/bin/app app.go

# Copy the exe into a smaller base image
FROM gcr.io/distroless/static-debian12
COPY --from=build-env /go/bin/app /
COPY static /static
ENTRYPOINT ["/app"]
