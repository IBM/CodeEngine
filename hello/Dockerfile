FROM registry.access.redhat.com/ubi10/nodejs-24:latest AS build-env
WORKDIR /app
RUN npm init -f && npm install
COPY server.js .

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs24
COPY --from=build-env /app /app
WORKDIR /app
EXPOSE 8080
CMD ["server.js"]