FROM icr.io/codeengine/golang:alpine AS bootstrap
WORKDIR /go/src/
COPY . .
RUN go build -o /thumbnail app.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=bootstrap /thumbnail /thumbnail
COPY page.html /
COPY pictures/* /pictures/
CMD ["/thumbnail"]
