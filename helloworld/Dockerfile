FROM quay.io/app-sre/ubi8-go-toolset AS build-env
COPY helloworld.go .
RUN CGO_ENABLED=0 go build -o /opt/app-root/src/app helloworld.go

# Copy the exe into a smaller base image
FROM registry.access.redhat.com/ubi9-minimal:latest
COPY --from=build-env /opt/app-root/src/app /
CMD ["/app"]
