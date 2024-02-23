FROM icr.io/codeengine/golang:alpine

COPY . /
RUN  go build -o /main /main.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /main /main
CMD /main
