# Stage 1: build
FROM quay.io/projectquay/golang:1.26 AS build
WORKDIR /src
COPY apiserver/go.mod apiserver/go.sum ./
RUN go mod download
COPY apiserver/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /apiserver ./cmd/apiserver

# Stage 2: runtime
# distroless/static is used here; the browser-client static files are served
# directly by the Go binary from /static (copied below).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /apiserver /apiserver
# Bundle the browser-client static files so the terminal UI is accessible
# at /ui/ via the apiserver endpoint — no local file:// page required.
# The build context root is remote-bob/ so browser-client/ is available here.
COPY browser-client/ /static/
USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/apiserver"]
