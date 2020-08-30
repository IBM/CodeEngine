FROM golang
COPY app.go /
RUN  go build -o /app /app.go
CMD  /app
