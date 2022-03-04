FROM icr.io/codeengine/golang
COPY app.go /go/src/
WORKDIR /go/src/
ENV GO111MODULE=off
RUN go get -d .
RUN go build -o /app app.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/ubuntu
COPY --from=0 /app /app
COPY page.html /
COPY pictures/* /pictures/
CMD /app
