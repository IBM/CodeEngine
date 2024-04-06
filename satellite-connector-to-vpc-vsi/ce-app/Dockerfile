FROM icr.io/codeengine/golang:latest AS stage

WORKDIR /app/src

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o app .

FROM icr.io/codeengine/alpine

WORKDIR /app/src

COPY --from=stage /app/src/app .

CMD [ "./app" ]