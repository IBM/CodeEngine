FROM icr.io/codeengine/golang:alpine
COPY app.go /go/src/
WORKDIR /go/src/
ENV GO111MODULE=off
RUN apk update && apk add git
RUN go get -d .
RUN go build -o /thumbnail app.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
COPY --from=0 /thumbnail /thumbnail
COPY page.html /
COPY pictures/* /pictures/
CMD /thumbnail
