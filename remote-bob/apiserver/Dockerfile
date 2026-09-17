# Stage 1: build
FROM quay.io/projectquay/golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /apiserver ./cmd/apiserver

# Stage 2: runtime
# distroless/static is used here; the browser-client static files are served
# directly by the Go binary from /static (copied below).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /apiserver /apiserver
# Bundle the browser-client static files so the terminal UI is accessible
# at /ui/ via the apiserver endpoint — no local file:// page required.
# The browser-client/ directory is copied from the parent build context,
# which the apiserver Dockerfile receives via --build-source pointing at
# remote-bob/apiserver/. A copy of browser-client/ is placed inside
# apiserver/ at build time by the CE build upload.
COPY browser-client/ /static/
USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/apiserver"]
