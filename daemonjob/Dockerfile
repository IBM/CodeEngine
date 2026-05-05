FROM quay.io/projectquay/golang:1.25 AS build-env
WORKDIR /go/src/app
COPY daemonjob.go .
RUN CGO_ENABLED=0 go build -o /go/bin/daemonjob daemonjob.go

# Copy the exe into a smaller base image
FROM gcr.io/distroless/static-debian13
COPY --from=build-env /go/bin/daemonjob /
ENTRYPOINT ["/daemonjob"]