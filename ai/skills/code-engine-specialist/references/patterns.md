# Code Engine Deployment Patterns Reference

## Workload-aware Deployment Decision Tree

**START: What do you want to deploy?**

**Do you have a container image already built?**
- YES → Use Pattern 2: Deploy from Container Image
  - Is it a private registry? → YES: Create registry secret first | NO: Deploy directly
- NO → Do you have source code?
  - YES → Does it have a Dockerfile?
    - YES → Use Pattern 1: Deploy from Source (dockerfile strategy)
    - NO → Create Dockerfile first (see Pattern 1 for language-specific examples)
  - NO → Is it in a Git repository?
    - YES → Ensure Dockerfile exists, then use Pattern 1: Deploy from Git Repository

**What does your workload do?**
- Responds to HTTP requests (web app, API, microservice)
  - Deploy as: APPLICATION
  - Use Pattern 3 for auto-scaling
  - Use Pattern 4 for env vars/secrets
  - Use Pattern 8 for health checks
- Processes data in batches or scheduled tasks
  - Deploy as: JOB
  - Use Pattern 5 for job configuration
  - Use Pattern 4 for env vars/secrets
- Responds to events (storage, messages, cron)
  - Deploy as: APPLICATION or JOB with EVENT SUBSCRIPTION
  - Use Pattern 6 for event-driven setup

**Does it need external services?**
- Database → Use Pattern 4: Create secrets for DATABASE_URL
- APIs → Use Pattern 4: Create secrets for API_KEY
- Object Storage → Use Pattern 4: Create secrets for credentials
- Message Queue → Use Pattern 4: Create secrets for broker URL

**What are your performance requirements?**
- Always available, low latency → min-scale=1+, max-scale=10-20
- Cost-optimized, tolerates cold starts → min-scale=0, max-scale=5-10
- High traffic, peak handling → min-scale=2-5, max-scale=50-100

**Multiple services (frontend + backend)?**
- Use Pattern 7: Multi-Service Deployment
- Deploy backend first, then frontend with backend URL

---

## Pattern 1: Deploy from Source Code

**When to Use:** Rapid prototyping, CI/CD from source, no container registry needed

**Prerequisites:** Ensure your project has a Dockerfile. If not, create one using these examples:

**Node.js Dockerfile:**
```dockerfile
# Download dependencies in builder stage
FROM registry.access.redhat.com/ubi10/nodejs-24:latest AS builder

COPY --chown=${CNB_USER_ID}:${CNB_GROUP_ID} package.json /app/
WORKDIR /app
RUN npm i --omit=dev

# Use a small distroless image for as runtime image
FROM gcr.io/distroless/nodejs24

COPY --chown=1001:0 --from=builder /app/node_modules /app/node_modules
COPY --chown=1001:0 . /app/

USER 1001:0
WORKDIR /app
EXPOSE 8080

CMD ["app.mjs"]
```

**Python Dockerfile:**
```dockerfile
# Download dependencies in builder stage
FROM registry.access.redhat.com/ubi9/python-312 AS builder

# Install dependencies
COPY requirements.txt .
RUN python -m pip install -r requirements.txt

# Build final stage
FROM registry.access.redhat.com/ubi10/python-312-minimal

ENV PYTHONPATH=/opt/app-root/lib/${PYTHON_VERSION}/site-packages

COPY --chown=1001:0 --from=builder /opt/app-root/lib/python3.12/site-packages ${PYTHONPATH}
COPY --chown=1001:0 *.py /opt/app-root/src/
COPY --chown=1001:0 utils/ /opt/app-root/src/utils
COPY --chown=1001:0 log_conf.yaml /opt/app-root/src/

USER 1001:0
WORKDIR /opt/app-root/src

CMD python app.py
```

**Java Dockerfile:**
```dockerfile
# Download dependencies and compile in builder stage
FROM registry.access.redhat.com/ubi10/openjdk-21 AS builder

COPY --chown=${UID} . /src
WORKDIR /src
RUN mvn package -Dmaven.test.skip=true

# Runtime stage using distroless
FROM gcr.io/distroless/java21-debian13:nonroot

# Copy the JAR from builder
COPY --chown=1001:0 --from=builder /src/target/*.jar /app/app.jar

USER 1001:0
WORKDIR /app
EXPOSE 8080 2112

# Run the application
CMD ["app.jar"]
```

**Go Dockerfile:**
```dockerfile
FROM quay.io/projectquay/golang:1.25 AS build-env
WORKDIR /go/src/app
COPY . .
RUN CGO_ENABLED=0 go build -o /go/bin/app main.go

# Runtime stage using distroless
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build-env /go/bin/app /
USER nonroot:nonroot
EXPOSE 8080 2112
ENTRYPOINT ["/app"]
```

**From Local Source:**
```bash
# Navigate to app directory
cd /path/to/your/app

# Deploy with Dockerfile
ibmcloud ce application create --name my-app \
  --build-source . \
  --strategy dockerfile \
  --port 8080
```

**From Git Repository:**
```bash
ibmcloud ce application create --name my-app \
  --build-source https://github.com/user/repo \
  --build-commit main \
  --strategy dockerfile \
  --port 8080
```

---

## Pattern 2: Deploy from Container Image

**When to Use:** Pre-built images, external registries, multi-stage builds

**Public Image:**
```bash
ibmcloud ce application create --name my-app \
  --image docker.io/username/my-app:latest \
  --port 8080
```

**Private Registry:**
```bash
# Create registry secret
ibmcloud ce registry create --name icr-secret \
  --server us.icr.io \
  --username iamapikey \
  --password <api-key>

# Deploy with registry secret
ibmcloud ce application create --name my-app \
  --image us.icr.io/namespace/my-app:v1.0 \
  --port 8080 \
  --registry-secret icr-secret
```

---

## Pattern 3: Auto-scaling Configuration

**When to Use:** Variable traffic, cost optimization, performance requirements

**Traffic Pattern Mapping:**
- Low (< 100 req/day): min=0, max=5, cpu=0.25, mem=0.5G
- Medium (100-10K req/day): min=1, max=10, cpu=0.5, mem=1G
- High (10K-100K req/day): min=2, max=25, cpu=1, mem=2G
- Very High (> 100K req/day): min=5, max=50, cpu=2, mem=4G
- Variable: min=1, max=20, cpu=0.5, mem=1G

**Configuration:**
```bash
ibmcloud ce application create --name my-app \
  --image us.icr.io/namespace/my-app:latest \
  --port 8080 \
  --min-scale 1 \
  --max-scale 10 \
  --scale-down-delay 300 \
  --cpu 0.5 \
  --memory 1G \
  --concurrency 100 \
  --request-timeout 300
```

---

## Pattern 4: Environment Variables and Secrets

**When to Use:** Configuration management, sensitive data, external services

**Environment Variables:**
```bash
ibmcloud ce application update --name my-app \
  --env NODE_ENV=production \
  --env LOG_LEVEL=info
```

**Secrets for Sensitive Data:**
```bash
# Create secret
ibmcloud ce secret create --name db-credentials \
  --from-literal DATABASE_URL=postgresql://user:pass@host:5432/db \
  --from-literal API_KEY=secret-key

# Use in application
ibmcloud ce application update --name my-app \
  --env-from-secret db-credentials
```

**ConfigMaps for Non-Sensitive Data:**
```bash
# Create configmap
ibmcloud ce configmap create --name app-config \
  --from-literal APP_NAME=MyApp \
  --from-literal FEATURE_FLAG=enabled

# Use in application
ibmcloud ce application update --name my-app \
  --env-from-configmap app-config
```

---

## Pattern 5: Jobs and Batch Processing

**When to Use:** Data processing, scheduled tasks, ETL operations, parallel processing

**Create and Run Job:**
```bash
# Create job
ibmcloud ce job create --name data-processor \
  --image us.icr.io/namespace/processor:latest \
  --cpu 2 \
  --memory 4G

# Run job
ibmcloud ce jobrun submit --name data-processor-run-1 \
  --job data-processor \
  --env INPUT_FILE=data.csv

# Run with parallel processing
ibmcloud ce jobrun submit --name parallel-job \
  --job data-processor \
  --array-indices 1-10
```

---

## Pattern 6: Event-Driven Applications

**When to Use:** React to storage events, messages, scheduled triggers

**Object Storage Events:**
```bash
ibmcloud ce subscription cos create --name cos-sub \
  --destination my-app \
  --bucket my-bucket \
  --event-type write
```

**Kafka Events:**
```bash
ibmcloud ce subscription kafka create --name kafka-sub \
  --destination my-app \
  --broker kafka-broker:9092 \
  --topic my-topic
```

**Cron Schedule:**
```bash
ibmcloud ce subscription cron create --name hourly-job \
  --destination my-app \
  --schedule "0 * * * *" \
  --data '{"task": "cleanup"}'
```

---

## Pattern 7: Multi-Service Deployment

**When to Use:** Frontend + Backend, microservices architecture

**Deployment Order Matters:**
```bash
# 1. Deploy backend first
ibmcloud ce application create --name backend \
  --image us.icr.io/namespace/backend:latest \
  --min-scale 1 \
  --port 8080

# 2. Get backend URL
BACKEND_URL=$(ibmcloud ce application get --name backend --output json | jq -r '.status.url')

# 3. Deploy frontend with backend URL
ibmcloud ce application create --name frontend \
  --image us.icr.io/namespace/frontend:latest \
  --env BACKEND_URL="$BACKEND_URL" \
  --min-scale 0 \
  --port 8080

# 4. Verify connectivity
echo "Backend: $BACKEND_URL"
echo "Frontend: $(ibmcloud ce application get --name frontend --output url)"
```

---

## Pattern 8: Health Checks

**When to Use:** Production deployments, ensure readiness before traffic

**Application Code (Node.js example):**
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

app.get('/ready', async (req, res) => {
  try {
    await database.ping();
    await cache.ping();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

**Code Engine Configuration:**
```bash
ibmcloud ce application update --name my-app \
  --probe-live type="http" \
  --probe-live path="/health" \
  --probe-live initial-delay=2 \
  --probe-live interval=10 \
  --probe-ready type="http" \
  --probe-ready path="/ready" \
  --probe-ready initial-delay=2 \
  --probe-ready interval=10
```

---

## Complete Production Example

**Full deployment with all best practices:**
```bash
# 1. Create project
ibmcloud ce project create --name production
ibmcloud ce project select --name production

# 2. Create secrets
ibmcloud ce secret create --name app-secrets \
  --from-literal DATABASE_URL=$DATABASE_URL \
  --from-literal API_KEY=$API_KEY

# 3. Deploy application
ibmcloud ce application create --name api-server \
  --build-source https://github.com/myorg/api-server \
  --build-commit main \
  --strategy dockerfile \
  --port 8080 \
  --min-scale 1 \
  --max-scale 20 \
  --cpu 0.5 \
  --memory 1G \
  --concurrency 100 \
  --env-from-secret app-secrets \
  --env NODE_ENV=production \
  --probe-live type="http" \
  --probe-live path="/health" \
  --probe-live initial-delay=2 \
  --probe-live interval=10 \
  --probe-ready type="http" \
  --probe-ready path="/health" \
  --probe-ready initial-delay=2 \
  --probe-ready interval=10

# 4. Verify deployment
ibmcloud ce application get --name api-server
curl $(ibmcloud ce application get --name api-server --output url)/health
```

---

## Best Practices
- Set min-scale > 0 for latency-sensitive apps
- Use appropriate concurrency settings (lower = better isolation)
- Always use secrets for sensitive data
- Use configmaps for non-sensitive configuration
- Set appropriate resource limits based on actual usage
- Configure health checks for production
- Use scale-to-zero for intermittent workloads
- Right-size resources through load testing
- Deploy backend services before frontend
- Use scale-down-delay to prevent thrashing

## Anti-Patterns to Avoid
- Hardcoding credentials in source code
- Setting min-scale too high for low-traffic apps
- Using jobs for HTTP services
- Not validating resource configurations
- Ignoring cold start implications
- Deploying frontend before backend
- Not implementing health checks
- Using localhost instead of 0.0.0.0
