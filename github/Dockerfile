FROM golang:alpine
COPY github.go /
RUN go build -o /github /github.go

# Copy the exe into a smaller base image
FROM alpine
COPY --from=0 /github /github
CMD /github
