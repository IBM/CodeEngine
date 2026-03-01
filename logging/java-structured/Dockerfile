# Download dependencies and compile in builder stage
FROM registry.access.redhat.com/ubi9/openjdk-21 AS builder

COPY --chown=${UID} . /src
WORKDIR /src
RUN mvn package -Dmaven.test.skip=true

# Build final stage
FROM gcr.io/distroless/java21

COPY --chown=1001:0 --from=builder /src/target/logging-1.0.0-SNAPSHOT.jar /app/logging-1.0.0-SNAPSHOT.jar

USER 1001:0
WORKDIR /app

CMD ["logging-1.0.0-SNAPSHOT.jar"]
