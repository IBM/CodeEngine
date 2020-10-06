FROM golang:alpine
COPY mapenv.go /
RUN go build -o /mapenv /mapenv.go

# Copy the exe into a smaller base image
FROM alpine
COPY --from=0 /mapenv /mapenv
CMD /mapenv
