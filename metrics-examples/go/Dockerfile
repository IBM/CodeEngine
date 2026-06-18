FROM quay.io/projectquay/golang:1.25 AS build-env
WORKDIR /go/src/app
COPY . .
RUN CGO_ENABLED=0 go build -o /go/bin/app main.go

# Runtime stage using distroless
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build-env /go/bin/app /
USER nonroot:nonroot
EXPOSE 8080 2112
ENTRYPOINT ["/app"]
