# Code Engine custom metrics examples for Java

This application helps debug connectivity issues for IBM Cloud Services and provides comprehensive monitoring through Prometheus metrics. It includes outbound HTTP call simulation, database connectivity testing, and compute-intensive workload simulation.

## Features

- **Outbound HTTP Calls**: Configurable endpoints that simulate delays and error responses to httpbin.org-compatible backends
- **Database Testing**: PostgreSQL connectivity verification with instrumented queries
- **Prometheus Metrics**: Comprehensive instrumentation for requests, outbound calls, database operations, and compute workloads using Micrometer
- **Load Testing**: Included shell script for generating realistic traffic patterns
- **Spring Boot**: Enterprise-grade framework with auto-configuration and dependency injection
- **Reactive HTTP Client**: Non-blocking WebClient for efficient outbound calls

## Quick Start

### Deploy to IBM Cloud Code Engine

Deploy the application with recommended resource settings:

```bash
ibmcloud ce application create \
  --name metrics-example-app-java \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --port 8080
```

To configure environment variables during deployment:

```bash
ibmcloud ce application create \
  --name metrics-example-app-java \
  --src "." \
  --memory 0.5G \
  --cpu 0.25 \
  --env HTTPBIN_BASE_URL=https://httpbin.org \
  --env METRICS_NAME_PREFIX=mymetrics_
```

Update an existing application:

```bash
ibmcloud ce application update \
  --name metrics-example-app-java \
  --env HTTPBIN_BASE_URL=https://custom-backend.example.com
```

### Run Locally

Pull and run with Docker:
```bash
docker pull icr.io/codeengine/metrics-example-app-java
docker run -p 8080:8080 -p 2112:2112 icr.io/codeengine/metrics-example-app-java
```

Or run from source:
```bash
mvn spring-boot:run
```

Or build and run the JAR:
```bash
mvn clean package
java -jar target/metrics-example-1.0.0.jar
```

The application exposes two servers:
- Main application: `http://localhost:8080`
- Metrics endpoint: `http://localhost:2112/metrics` (Prometheus format)
- Health check: `http://localhost:2112/health`

## Configuration

### Environment Variables

- `PORT`: Application server port (default: 8080)
- `HTTPBIN_BASE_URL`: Backend URL for outbound calls (default: `https://httpbin.org`)
- `METRICS_NAME_PREFIX`: Prefix for all Prometheus metrics (default: `mymetrics_`)
- `DATABASES_FOR_POSTGRESQL_CONNECTION`: PostgreSQL connection credentials (JSON format)
- `CE_APP`: Application name for health check response

### Service Bindings

For database connectivity, create a Code Engine service binding between your project and the IBM Cloud service. See [Working with service bindings](https://cloud.ibm.com/docs/codeengine?topic=codeengine-service-binding) for details.

## API Endpoints

- `GET /` - Health check
- `GET /test-db` - Test PostgreSQL connectivity
- `GET /outbound/delay` - Outbound call with random delay (0-2s) and 5% error rate
- `GET /outbound/get` - Simple outbound GET request
- `POST /outbound/post` - Outbound POST request
- `GET /outbound/status/{code}` - Request specific HTTP status code

Management endpoints (port 2112):
- `GET /metrics` - Prometheus metrics endpoint (Prometheus text format)
- `GET /health` - Health check endpoint

All outbound endpoints include simulated compute-intensive data processing (0-3s duration, 40-80% CPU intensity).

## Metrics

The application exposes Prometheus metrics at `/metrics` (port 2112) in Prometheus text format. All metric names are prefixed with a configurable value set via the `METRICS_NAME_PREFIX` environment variable (default: `mymetrics_`).

### Filtering Metrics

By default, Spring Boot exports many JVM, system, and application metrics. You can control which metrics are exported using the following approaches:

**Option 1: Disable entire metric categories**

Set these properties to `false` to exclude entire categories of metrics:

```properties
management.metrics.enable.jvm=false          # Disable all JVM metrics
management.metrics.enable.process=false      # Disable process metrics
management.metrics.enable.system=false       # Disable system metrics
management.metrics.enable.tomcat=false       # Disable Tomcat metrics
management.metrics.enable.logback=false      # Disable logback metrics
management.metrics.enable.executor=false     # Disable executor metrics
management.metrics.enable.disk=false         # Disable disk metrics
management.metrics.enable.application=false  # Disable application startup metrics
```

**Option 2: Keep only custom metrics**

To export only your custom metrics (those with the `mymetrics_` prefix), disable all default categories:

```bash
ibmcloud ce application update \
  --name metrics-example-app-java \
  --env management.metrics.enable.jvm=false \
  --env management.metrics.enable.process=false \
  --env management.metrics.enable.system=false \
  --env management.metrics.enable.tomcat=false \
  --env management.metrics.enable.logback=false \
  --env management.metrics.enable.executor=false \
  --env management.metrics.enable.disk=false \
  --env management.metrics.enable.application=false
```

**Option 3: Use a MeterFilter for fine-grained control**

For more advanced filtering, you can create a custom `MeterFilter` bean in your configuration. See the [Micrometer documentation](https://micrometer.io/docs/concepts#_meter_filters){: external} for details.

**Request Metrics**
- `mymetrics_requests_total`: Total requests by method and path

**Outbound Call Metrics**
- `mymetrics_outbound_request_duration_seconds`: Timer for outbound request durations
- `mymetrics_outbound_requests_total`: Total outbound requests by target, method, and status

**Database Metrics**
- `mymetrics_db_query_duration_seconds`: Timer for query durations by operation and table
- `mymetrics_db_queries_total`: Total queries by operation, table, and status
- `mymetrics_db_connections_active`: Active database connections gauge

**Compute Metrics**
- `mymetrics_compute_duration_seconds`: Timer for compute operation durations

**JVM Metrics** (automatically collected by Micrometer)
- JVM memory, threads, GC, class loading, and more

## Development

### Prerequisites

- Java 21 or later
- Maven 3.9 or later
- Docker (for containerized builds)

### Building

```bash
# Build the project
mvn clean package

# Run the application
mvn spring-boot:run

# Run with custom profile
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Build Docker image
docker build -t metrics-example-app-java .

# Run tests
mvn test
```

### Project Structure

```
java/
├── pom.xml                                    # Maven project configuration
├── Dockerfile                                 # Multi-stage Docker build
├── README.md                                  # This file
└── src/main/
    ├── java/com/ibm/codeengine/metrics/
    │   ├── MetricsApplication.java           # Main application class
    │   ├── config/
    │   │   ├── MetricsConfig.java            # Metrics configuration
    │   │   └── DatabaseConfig.java           # Database configuration
    │   ├── controller/
    │   │   └── MetricsController.java        # REST endpoints
    │   ├── service/
    │   │   ├── OutboundService.java          # HTTP client service
    │   │   ├── DatabaseService.java          # Database service
    │   │   └── ComputeService.java           # Compute simulation
    │   └── model/
    │       └── OutboundCallResult.java       # Data model
    └── resources/
        └── application.properties             # Application configuration
```

## Performance Characteristics

- **Startup Time**: ~5-10 seconds (JVM warmup)
- **Memory Footprint**: ~200-250 MB (JVM + application)
- **Image Size**: ~200-250 MB (distroless with JRE)
- **Concurrency**: Thread-based with reactive HTTP client
- **CPU Efficiency**: Good after JVM warmup and JIT compilation

## Spring Boot Features

This implementation uses Spring Boot 3.x, which provides:

- **Auto-configuration**: Automatic setup of common components
- **Dependency Injection**: Clean, testable code architecture
- **Actuator**: Production-ready features like health checks and metrics
- **Micrometer**: Vendor-neutral metrics facade with Prometheus support
- **WebFlux**: Reactive, non-blocking HTTP client
- **HikariCP**: High-performance JDBC connection pooling

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Verify the `DATABASES_FOR_POSTGRESQL_CONNECTION` environment variable is set correctly
2. Check that the service binding is properly configured
3. Ensure the certificate is valid and properly base64 encoded
4. Verify network connectivity to the PostgreSQL instance
5. Check Spring Boot logs for detailed error messages

### Build Issues

If Maven build fails:

```bash
# Clean and rebuild
mvn clean install -U

# Skip tests if needed
mvn clean package -DskipTests
```

### Memory Issues

For memory-constrained environments:

```bash
# Set JVM memory limits
java -Xmx256m -Xms128m -jar target/metrics-example-1.0.0.jar

# Or via environment variable
JAVA_OPTS="-Xmx256m -Xms128m" java -jar target/metrics-example-1.0.0.jar
```

### Slow Startup

To improve startup time:

```bash
# Use CDS (Class Data Sharing)
java -Xshare:on -jar target/metrics-example-1.0.0.jar

# Reduce logging during startup
java -Dlogging.level.root=WARN -jar target/metrics-example-1.0.0.jar
```

## Micrometer Integration

This application uses Micrometer for metrics, which provides:

- **Multiple Backend Support**: Easy to switch from Prometheus to other systems
- **Dimensional Metrics**: Tags/labels for flexible querying
- **Timer Support**: Automatic percent tiles and distribution summaries
- **JVM Metrics**: Comprehensive runtime monitoring
- **Spring Integration**: Seamless integration with Spring Boot Actuator
