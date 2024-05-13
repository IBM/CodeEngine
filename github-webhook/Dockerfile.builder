FROM icr.io/codeengine/golang:latest AS stage

ENV GOTOOLCHAIN auto

WORKDIR /app/src

COPY cmd/builder/ ./builder/

COPY go.mod .

COPY go.sum .

RUN CGO_ENABLED=0 GOOS=linux go build -o builder ./builder

FROM icr.io/codeengine/alpine

WORKDIR /app/src

COPY --from=stage /app/src/builder/builder .

CMD [ "./builder" ]