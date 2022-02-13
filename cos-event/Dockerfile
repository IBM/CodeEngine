FROM icr.io/codeengine/golang:alpine
COPY cos-listen.go /
RUN go build -o /cos-listen /cos-listen.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /cos-listen /cos-listen
CMD /cos-listen
