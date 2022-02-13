FROM icr.io/codeengine/golang:alpine
COPY app.go /
RUN  go build -o /app /app.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /app /app
CMD  /app
