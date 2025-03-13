FROM registry.access.redhat.com/ubi9/nodejs-22:latest AS build-env
WORKDIR /app

# Copy job dependency manifests to the container image.
COPY package.json ./

# Install production dependencies.
RUN npm install --production

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Copy local code to the container image.
COPY ./src ./

# Copy the dependencies and other project related files
COPY --from=build-env /app ./

CMD ["job.mjs"]