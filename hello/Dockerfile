FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:latest AS build-env
WORKDIR /app
RUN npm init -f && npm install
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]

FROM gcr.io/distroless/nodejs20-debian12
COPY --from=build-env /app /app
WORKDIR /app
EXPOSE 8080
CMD ["server.js"]