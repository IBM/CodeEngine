FROM icr.io/codeengine/golang AS bootstrap
WORKDIR /go/src/
COPY . .
RUN go build -o /app app.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/ubuntu
COPY --from=bootstrap /app /app
COPY page.html /
COPY pictures/* /pictures/
CMD ["/app"]
