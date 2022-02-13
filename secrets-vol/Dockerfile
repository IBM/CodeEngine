FROM icr.io/codeengine/golang:alpine
COPY secret.go /
RUN go build -o /secret /secret.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /secret /secret
CMD /secret
