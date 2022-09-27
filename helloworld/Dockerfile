FROM icr.io/codeengine/golang:alpine
COPY helloworld.go /
RUN go build -ldflags '-s -w -extldflags "-static"' -o /helloworld /helloworld.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /helloworld /helloworld
CMD /helloworld
