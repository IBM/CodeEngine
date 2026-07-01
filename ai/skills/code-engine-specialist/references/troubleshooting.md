# Code Engine Troubleshooting Reference

## Common Deployment Issues

### Issue 1: Architecture Mismatch (exec format error)

**Symptoms:** App crashes immediately, logs show "exec format error", CrashLoopBackOff status

**Detection:**
```bash
ibmcloud ce application logs --name myapp --tail 100 | grep -i "exec format error"
ibmcloud ce application get --name myapp
```

**Root Cause:** Container built for ARM64 but Code Engine runs on x86_64

**Solution:**
```bash
# Rebuild with correct architecture
docker build --platform linux/amd64 -t myimage .
docker push us.icr.io/namespace/myapp:latest

# Or use Code Engine's build service
ibmcloud ce application update --name myapp --build-source . --strategy dockerfile
```

### Issue 2: Port Configuration Mismatch

**Symptoms:** Deployment succeeds but app not accessible, 502 errors, health checks failing

**Detection:**
```bash
ibmcloud ce application logs --name myapp --tail 100 | grep -i "listening"
ibmcloud ce application get --name myapp | grep "Port:"
```

**Root Cause:** App listens on different port than Code Engine expects

**Solution:**
```bash
# Update Code Engine to match app port
ibmcloud ce application update --name myapp --port 3000

# Or set PORT env var
ibmcloud ce application update --name myapp --env PORT=8080
```

### Issue 3: Resource Limit Issues (OOM Kills)

**Symptoms:** Frequent restarts, "Out of Memory" in logs, performance degradation

**Detection:**
```bash
ibmcloud ce application events --name myapp | grep -i "OOMKilled"
ibmcloud ce application get --name myapp | grep -A 5 "Resources"
```

**Root Cause:** Memory usage exceeds allocated limits

**Solution:**
```bash
# Increase memory allocation
ibmcloud ce application update --name myapp --memory 2G

# Or increase both CPU and memory
ibmcloud ce application update --name myapp --cpu 1.0 --memory 2G
```

### Issue 4: Cold Start Issues

**Symptoms:** First request takes 10-30 seconds, 502 errors after idle period

**Detection:**
```bash
ibmcloud ce application get --name myapp | grep -A 3 "Scale"
ibmcloud ce application get --name myapp --output json | jq '.spec.scaleMinInstances'
```

**Root Cause:** App scales to zero (min-scale=0) causing cold starts

**Solution:**
```bash
# Keep at least one instance running
ibmcloud ce application update --name myapp --min-scale 1
```

### Issue 5: Missing Environment Variables

**Symptoms:** App crashes on startup, "undefined" errors, database connection failures

**Detection:**
```bash
ibmcloud ce application logs --name myapp --tail 100 | grep -i "undefined\|null\|not found"
ibmcloud ce application get --name myapp --output json | jq '.spec.template.spec.containers[0].env'
```

**Root Cause:** Required environment variables not configured

**Solution:**
```bash
# Create secret for sensitive data
ibmcloud ce secret create --name myapp-secrets \
  --from-literal DATABASE_URL=postgresql://... \
  --from-literal API_KEY=secret-key

# Update app to use secret
ibmcloud ce application update --name myapp --env-from-secret myapp-secrets
```

### Issue 6: Multi-Service Deployment Order

**Symptoms:** Frontend can't connect to backend, 502/503 errors, connection refused

**Detection:**
```bash
# Check if backend is running
ibmcloud ce application get --name backend-app

# Get backend URL
BACKEND_URL=$(ibmcloud ce application get --name backend-app --output json | jq -r '.status.url')

# Test backend connectivity
curl -f $BACKEND_URL/health || echo "Backend not accessible"
```

**Root Cause:** Frontend deployed before backend or missing backend URL

**Solution:**
```bash
# Deploy backend first
ibmcloud ce application create --name backend-app \
  --image us.icr.io/namespace/backend:latest \
  --min-scale 1 --port 8080

# Get backend URL
BACKEND_URL=$(ibmcloud ce application get --name backend-app --output json | jq -r '.status.url')

# Deploy frontend with backend URL
ibmcloud ce application create --name frontend-app \
  --image us.icr.io/namespace/frontend:latest \
  --env BACKEND_URL="$BACKEND_URL" --port 8080
```

### Issue 7: Health Check Failures

**Symptoms:** App keeps restarting, "Unhealthy" status, health check timeouts

**Detection:**
```bash
ibmcloud ce application get --name myapp --output json | jq '.spec.template.spec.containers[0].livenessProbe'
ibmcloud ce application events --name myapp | grep -i "unhealthy\|liveness"
```

**Root Cause:** Health check endpoint missing or returning wrong status

**Solution:**
```bash
# Configure health checks
ibmcloud ce application update --name myapp \
  --probe-live type="http" \
  --probe-live path="/health" \
  --probe-live initial-delay=30 \
  --probe-live interval=10
```

### Issue 8: Scaling Issues

**Symptoms:** App hitting max-scale, performance degradation, 503 errors under load

**Detection:**
```bash
ibmcloud ce application get --name myapp | grep "Running instances"
ibmcloud ce application get --name myapp | grep -A 5 "Scale"
```

**Root Cause:** Max-scale too low or concurrency settings inappropriate

**Solution:**
```bash
# Increase max-scale
ibmcloud ce application update --name myapp --max-scale 20

# Adjust concurrency
ibmcloud ce application update --name myapp --concurrency 100
```

### Quick Troubleshooting Workflow

When deployment fails, follow this systematic approach:

1. **Check application status:** `ibmcloud ce application get --name <app-name>`
2. **Check logs for errors:** `ibmcloud ce application logs --name <app-name> --tail 100 | grep -i "error\|fail\|crash"`
3. **Check events:** `ibmcloud ce application events --name <app-name> | tail -20`
4. **Check resource usage:** `ibmcloud ce application get --name <app-name> | grep -A 5 "Resources"`
5. **Test connectivity:** `curl -f $(ibmcloud ce application get --name <app-name> --output url)/health`
6. **Check scaling:** `ibmcloud ce application get --name <app-name> | grep -A 5 "Scale"`

---

## Diagnostic Patterns

### Pattern 1: Application Won't Deploy

**Symptoms:** Deployment succeeds but app never ready, stuck in "ContainerCreating", 503 errors

**Investigation Steps:**
1. Check app and revision status: `ibmcloud ce app get --name <app-name>`
2. List revisions: `ibmcloud ce revision list --application <app-name>`
3. Check logs for image pull failures: `ibmcloud ce app logs --application <app-name> --tail 100`
4. Verify registry access: `ibmcloud ce registry list`

**Common Causes:**
- Missing registry credentials → Create registry secret
- Wrong image reference → Verify image name and tag
- Port mismatch → Update port configuration
- Startup probe failure → Check application logs

### Pattern 2: Application Crashes After Deployment

**Symptoms:** App becomes ready then fails, intermittent 502/503 errors, high restart count

**Investigation Steps:**
1. Check revision status: `ibmcloud ce app get --name <app-name>`
2. Examine logs: `ibmcloud ce app logs --application <app-name> --tail 200`
3. Check resource limits: `ibmcloud ce app get --name <app-name> | grep -E "CPU|Memory"`
4. Check events: `ibmcloud ce app events --name <app-name>`

**Common Causes:**
- Memory limit too low → Increase memory allocation
- Missing environment variables → Add required env vars or secrets
- Dependency connection failure → Check service bindings
- Concurrency too high → Reduce concurrency setting

### Pattern 3: Job Run Fails

**Symptoms:** Job exits with non-zero status, times out, inconsistent failures

**Investigation Steps:**
1. Identify failing run: `ibmcloud ce jobrun list`
2. Get run details: `ibmcloud ce jobrun get --name <jobrun-name>`
3. Check logs: `ibmcloud ce jobrun logs --jobrun <jobrun-name>`
4. Compare with job definition: `ibmcloud ce job get --name <job-name>`

**Common Causes:**
- Command/arguments incorrect → Update job command
- Timeout too short → Increase maxexecutiontime
- Insufficient resources → Increase CPU and memory
- Missing dependencies → Check container image

### Pattern 4: Build Fails

**Symptoms:** Build never completes, fails with error, app deployment fails due to missing image

**Investigation Steps:**
1. Check build status: `ibmcloud ce build list`
2. Get build details: `ibmcloud ce build get --name <build-name>`
3. Check for error messages in build output

**Common Causes:**
- Source repository access denied → Create/update repo access
- Registry push failure → Verify registry credentials
- Dockerfile errors → Check Dockerfile syntax
- Build timeout → Increase build timeout

### Pattern 5: Scaling Issues

**Symptoms:** Slow response under load, unexpected cold starts, doesn't scale up

**Investigation Steps:**
1. Check scaling config: `ibmcloud ce app get --name <app-name> | grep -E "Min Scale|Max Scale|Concurrency"`
2. Check instance count: `ibmcloud ce revision list --application <app-name>`
3. Monitor scaling events: `ibmcloud ce app events --name <app-name> | grep -i "scale"`

**Common Causes:**
- Min scale = 0 causing cold starts → Set min-scale to 1
- Max scale too low → Increase max-scale
- Concurrency too high → Reduce concurrency
- Slow startup time → Optimize application startup

### Pattern 6: Revision Rollout Problems

**Symptoms:** New revision created but traffic stays on old, intermittent errors after deployment

**Investigation Steps:**
1. List revisions: `ibmcloud ce revision list --application <app-name>`
2. Check traffic routing: `ibmcloud ce app get --name <app-name> | grep -A 5 "Traffic"`
3. Compare configurations: `ibmcloud ce revision get --name <revision-name>`

**Common Causes:**
- Latest revision not ready → Fix readiness failure
- Configuration change broke app → Route traffic back to previous revision
- Need gradual rollout → Split traffic between revisions

### Pattern 7: Environment Variable Issues

**Symptoms:** App fails at startup with configuration errors, "variable not found" in logs

**Investigation Steps:**
1. List env vars: `ibmcloud ce app get --name <app-name> | grep -A 20 "Environment Variables"`
2. Check for missing values
3. Verify secret references: `ibmcloud ce secret list`

**Common Causes:**
- Missing environment variable → Add env var
- Secret not mounted → Create and reference secret
- ConfigMap not mounted → Create and reference configmap
