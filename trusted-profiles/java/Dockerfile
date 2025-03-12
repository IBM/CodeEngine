# Download dependencies and compile in builder stage
FROM registry.access.redhat.com/ubi9/openjdk-21 AS builder

COPY --chown=${UID} . /src
WORKDIR /src
RUN mvn package -Dmaven.test.skip=true

# Build final stage
FROM gcr.io/distroless/java21

COPY --chown=1001:0 --from=builder /src/target/trustedprofiles-1.0-SNAPSHOT.jar /app/trustedprofiles-1.0-SNAPSHOT.jar

USER 1001:0
WORKDIR /app

CMD ["trustedprofiles-1.0-SNAPSHOT.jar"]
