FROM golang:alpine
COPY pingjob.go /
RUN go build -o /pingjob /pingjob.go

# Copy the exe into a smaller base image
FROM alpine
COPY --from=0 /pingjob /pingjob
CMD /pingjob
