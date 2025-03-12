# Download dependencies in builder stage
FROM registry.access.redhat.com/ubi9/nodejs-22 AS builder

COPY --chown=${CNB_USER_ID}:${CNB_GROUP_ID} package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

# Build final stage
FROM gcr.io/distroless/nodejs22

COPY --chown=1001:0 --from=builder /app/node_modules /app/node_modules
COPY --chown=1001:0 main.js /app

USER 1001:0
WORKDIR /app

CMD ["main.js"]
