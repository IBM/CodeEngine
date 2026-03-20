# Download dependencies and compile in builder stage
FROM registry.access.redhat.com/ubi9/openjdk-21 AS builder

COPY --chown=${UID} . /src
WORKDIR /src
RUN mvn package -Dmaven.test.skip=true

# Runtime stage using distroless
FROM gcr.io/distroless/java21-debian12:nonroot

# Copy the JAR from builder
COPY --chown=1001:0 --from=builder /src/target/*.jar /app/app.jar

USER 1001:0
WORKDIR /app
EXPOSE 8080 2112

# Run the application
CMD ["app.jar"]
