FROM registry.access.redhat.com/ubi9/nodejs-24:latest AS build-env
WORKDIR /app
COPY package.json .
RUN npm install

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs24-debian12
COPY --from=build-env /app /app
WORKDIR /app
COPY index.mjs public/ .
EXPOSE 8080
CMD ["index.mjs"]