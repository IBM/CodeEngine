FROM registry.access.redhat.com/ubi10/nodejs-22-minimal:latest AS build-env
WORKDIR /app

# Define which files should be copied into the container image
COPY *.js .
COPY page.* .
COPY pictures/* pictures/
COPY package.json .
RUN mkdir tmp/

# Load all dependencies
RUN npm install

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs22-debian12
COPY --from=build-env /app /app
WORKDIR /app
EXPOSE 8080
CMD ["app.js"]