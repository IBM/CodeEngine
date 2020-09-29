# Copyright Contributors to the Code Engine Samples project

FROM golang:buster as build

# Silence frontend related debconf messages
ENV DEBIAN_FRONTEND noninteractive

# Switch to a Unicode locale
ENV LANG C.UTF-8

# Non-root user settings, use "random" uid > 10000
ENV USER=runner
ENV UID=17649

    # Refresh package index files
    # --assume-yes: Automatic yes to prompts
    # --quiet: Logging but omit progress indicators
RUN apt-get update --assume-yes --quiet && \
    \
    \
    # Install required packages for build and runtime
    # Runtime files will be copied to runtime image
    apt-get install --assume-yes --quiet \
      ca-certificates \
      tzdata && \
    \
    \
    # Add new user, created files will be copied to runtime image
    # golang needs a home directory
    # User has no password and cannot log in
    # Login shell won't exist in target image
    adduser \
      --home "/${USER}" \
      --shell "/usr/sbin/nologin" \
      --uid "${UID}" \
      --gecos "" \
      --disabled-password \
      "${USER}"

# Use / as working directory
WORKDIR /

# Copy source from build context into container
COPY helloworld.go .

# Set target OS / architecture for golang, disable cgo
ENV GOOS=linux
ENV GOARCH=amd64
ENV CGO_ENABLED=0

# Build a static binary for target OS / architecture
RUN go version && \
    \
    \
    go build \
      -a \
      -ldflags='-extldflags "-static"' \
      -o helloworld \
      helloworld.go

### Target image
FROM scratch

# Switch to target user... must be the same as specified with USER above
USER runner:runner

# Set the working directory... must be the same as specified with USER above
WORKDIR /runner

# Copy required files from build image to target image
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group

# Copy static binary to run from build image to target image
COPY --from=build /helloworld .

# Run the binary
ENTRYPOINT [ "./helloworld" ]