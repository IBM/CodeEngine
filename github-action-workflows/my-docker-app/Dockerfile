FROM quay.io/projectquay/golang:1.24 AS build-env

WORKDIR /go/src/app

COPY main.go main.go

RUN CGO_ENABLED=0 go build -o /go/bin/app main.go

FROM gcr.io/distroless/static-debian12

EXPOSE 3000

COPY --from=build-env /go/bin/app /

ENTRYPOINT ["/app"]