FROM quay.io/projectquay/golang:1.25 AS build-env

WORKDIR /go/src/app

COPY main.go main.go

RUN CGO_ENABLED=0 go build -o /go/bin/app main.go

FROM gcr.io/distroless/static-debian13

EXPOSE 3000

COPY --from=build-env /go/bin/app /

ENTRYPOINT ["/app"]