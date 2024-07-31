FROM icr.io/codeengine/golang:alpine
RUN apk -U upgrade
ENV GOTOOLCHAIN auto
COPY . /
RUN  go build -o /main /main.go

# Copy the exe into a smaller base image
FROM icr.io/codeengine/alpine
RUN apk -U upgrade
COPY --from=0 /main /main
CMD /main
