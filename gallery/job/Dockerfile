FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS build-env
WORKDIR /app

# Define which files should be copied into the container image
COPY *.js .
COPY package.json .

# Load all dependencies
RUN npm install

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs20-debian12
COPY --from=build-env /app /app
WORKDIR /app
ENTRYPOINT ["job.js"]
