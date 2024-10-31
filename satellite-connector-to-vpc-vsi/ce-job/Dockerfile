FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS build-env
WORKDIR /job

# Define which files should be copied into the container image
COPY --chown=default:root *.mjs *.json .

# Load all dependencies
RUN npm install

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs20-debian12
COPY --from=build-env /job /job
WORKDIR /job
ENTRYPOINT ["job.mjs"]
