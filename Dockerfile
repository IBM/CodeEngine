FROM icr.io/codeengine/golang:alpine
COPY ./helloworld /helloworld
COPY codeengine.go /
RUN go build -o /codeengine /codeengine.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /codeengine /codeengine
CMD /codeengine
