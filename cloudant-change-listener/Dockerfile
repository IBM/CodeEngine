FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS build-env
WORKDIR /opt/app-root/src
COPY --chown=default:root job/* .
RUN npm install

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs20-debian12
COPY --from=build-env /opt/app-root/src /app
WORKDIR /app
CMD ["job.mjs"]