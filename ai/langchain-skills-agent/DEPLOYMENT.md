# Deployment Guide - LangChain Skills Agent on IBM Cloud Code Engine

This guide walks you through deploying the LangChain Skills Agent to IBM Cloud Code Engine using the Dockerfile strategy.

## 📋 Prerequisites

### 1. IBM Cloud Account
- Sign up at [IBM Cloud](https://cloud.ibm.com)
- Ensure you have access to Code Engine service

### 2. RedHat AI Inference Service
- Access the [RedHat AI Inference Service](https://cloud.ibm.com/inference/overview)
- Create a project and note your project ID
- Generate an IBM Cloud API key

### 3. IBM Cloud CLI
Install the IBM Cloud CLI:
```bash
curl -fsSL https://clis.cloud.ibm.com/install/linux | sh
```

Install the Code Engine plugin:
```bash
ibmcloud plugin install code-engine
```

### 4. Optional API Keys
For full functionality, obtain:
- **OpenWeather API Key**: [https://openweathermap.org/api](https://openweathermap.org/api)
- **Exchange Rate API Key**: [https://www.exchangerate-api.com/](https://www.exchangerate-api.com/)

## 🔧 Configuration

### Step 1: Configure Environment Variables

1. Copy the sample environment file:
   ```bash
   cp .env.sample .env
   ```

2. Edit `.env` with your credentials:
   ```bash
   # RedHat AI Inference Service
   INFERENCE_BASE_URL=https://us-east.rhai.ibm.com/v1/projects/YOUR_PROJECT_ID/inference
   IBM_CLOUD_API_KEY=YOUR_IBM_CLOUD_API_KEY
   INFERENCE_MODEL_NAME=llama-3-3-70b-instruct
   
   # Optional API Keys
   OPENWEATHER_API_KEY=YOUR_OPENWEATHER_API_KEY
   EXCHANGE_RATE_API_KEY=YOUR_EXCHANGE_RATE_API_KEY
   
   # IBM Cloud Configuration
   REGION=eu-de
   PROJECT_NAME=langchain-skills-agent-project
   NAME_PREFIX=ce-langchain-agent
   ```

### Step 2: Authenticate to IBM Cloud

Choose one of the following methods:

**Option A: SSO Authentication**
```bash
ibmcloud login --sso
```

**Option B: API Key Authentication**
```bash
ibmcloud login --apikey YOUR_IBM_CLOUD_API_KEY
```

## 🚀 Deployment

### Automated Deployment

The `deploy.sh` script handles the complete deployment process:

```bash
./deploy.sh
```

This script will:
1. ✅ Update IBM Cloud CLI and plugins
2. ✅ Create a resource group (if needed)
3. ✅ Create a Code Engine project
4. ✅ Create a secret with your environment variables
5. ✅ Build the Docker image using the Dockerfile
6. ✅ Deploy the application with optimal configuration
7. ✅ Configure health checks and auto-scaling
8. ✅ Provide the application URL

### What the Deployment Includes

**Application Configuration:**
- **Build Strategy**: Dockerfile (multi-stage build for optimization)
- **CPU**: 1 vCPU
- **Memory**: 4GB
- **Port**: 8080
- **Min Scale**: 1 instance (always available)
- **Max Scale**: 10 instances (auto-scales based on load)
- **Health Check**: `/health` endpoint with 30s initial delay
- **Visibility**: Public (accessible via HTTPS)

**Security:**
- All sensitive credentials stored in Code Engine secrets
- HTTPS endpoint with managed certificate
- Non-root container user (UID 1001)
- Minimal base image (UBI Python)

## 📊 Monitoring Deployment

### Check Application Status
```bash
ibmcloud ce application get --name langchain-agent
```

### View Application Logs
```bash
ibmcloud ce application logs --name langchain-agent --tail 100
```

### Follow Logs in Real-time
```bash
ibmcloud ce application logs --name langchain-agent --follow
```

### Check Application Events
```bash
ibmcloud ce application events --name langchain-agent
```

## 🧪 Testing the Deployment

### 1. Access the Landing Page
The deployment script will output the application URL. Open it in your browser:
```
https://langchain-agent.xxx.codeengine.appdomain.cloud
```

### 2. Test the Health Endpoint
```bash
curl https://YOUR_APP_URL/health
```

Expected response:
```json
{
  "status": "healthy",
  "agent": "Travel_Weather_Assistant",
  "skills_loaded": 3
}
```

### 3. Get Agent Information
```bash
curl https://YOUR_APP_URL/info | jq
```

### 4. Test the Agent
```bash
curl -X POST https://YOUR_APP_URL/runs \
  -H "Content-Type: application/json" \
  -d @payload/payload.json | jq
```

Or use the example from the script output:
```bash
curl -X POST https://YOUR_APP_URL/runs \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "Travel_Weather_Assistant",
    "input": [{
      "role": "user",
      "parts": [{
        "content": "What is the weather in Paris?"
      }]
    }]
  }' | jq
```

## 🔄 Updating the Application

### Update Environment Variables
```bash
# Update the secret
ibmcloud ce secret update --name langchain-agent-secret \
  --from-literal IBM_CLOUD_API_KEY="NEW_API_KEY"

# Restart the application to pick up changes
ibmcloud ce application update --name langchain-agent
```

### Update Application Code
```bash
# Rebuild and redeploy
ibmcloud ce application update --name langchain-agent \
  --build-source ./src \
  --strategy dockerfile
```

### Scale the Application
```bash
# Adjust scaling parameters
ibmcloud ce application update --name langchain-agent \
  --min-scale 2 \
  --max-scale 20 \
  --concurrency 50
```

### Update Resource Allocation
```bash
# Increase CPU and memory
ibmcloud ce application update --name langchain-agent \
  --cpu 2 \
  --memory 8G
```

## 🧹 Cleanup

To remove all created resources and avoid charges:

```bash
./deploy.sh clean
```

This will delete:
- The Code Engine application
- The Code Engine project
- All secrets and configurations
- The resource group

## 🔍 Troubleshooting

### Application Not Starting

**Check logs for errors:**
```bash
ibmcloud ce application logs --name langchain-agent --tail 200
```

**Common issues:**
- Missing environment variables → Verify secret configuration
- Port mismatch → Application listens on 8080
- Memory issues → Increase memory allocation

### Build Failures

**Check build logs:**
```bash
ibmcloud ce buildrun logs --name langchain-agent-xxxxx
```

**Common issues:**
- Dockerfile syntax errors → Validate Dockerfile
- Dependency installation failures → Check pyproject.toml
- Network issues → Retry the build

### Health Check Failures

**Verify health endpoint:**
```bash
# Get application URL
APP_URL=$(ibmcloud ce application get --name langchain-agent --output json | jq -r '.status.url')

# Test health endpoint
curl $APP_URL/health
```

**Common issues:**
- Application not listening on 0.0.0.0 → Check main.py
- Health check timeout too short → Increase initial delay
- Application startup slow → Increase probe-live-initial-delay

### Performance Issues

**Check current scaling:**
```bash
ibmcloud ce application get --name langchain-agent | grep -A 5 "Scale"
```

**Optimize scaling:**
```bash
# Increase max scale for high traffic
ibmcloud ce application update --name langchain-agent --max-scale 20

# Keep more instances warm
ibmcloud ce application update --name langchain-agent --min-scale 2

# Adjust concurrency
ibmcloud ce application update --name langchain-agent --concurrency 50
```

## 📚 Additional Resources

- [IBM Cloud Code Engine Documentation](https://cloud.ibm.com/docs/codeengine)
- [RedHat AI Inference Service](https://cloud.ibm.com/inference/overview)
- [Code Engine CLI Reference](https://cloud.ibm.com/docs/codeengine?topic=codeengine-cli)
- [LangChain Documentation](https://python.langchain.com/)

## 🔐 Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use Code Engine secrets** - All credentials are stored securely
3. **Rotate API keys regularly** - Update secrets when keys change
4. **Monitor access logs** - Review application logs for suspicious activity
5. **Use HTTPS only** - Code Engine provides managed certificates
6. **Implement authentication** - Add authentication for production use

## 💡 Next Steps

After successful deployment:

1. **Add Custom Domain**: Configure a custom domain for your application
2. **Set Up Monitoring**: Use IBM Cloud Monitoring for observability
3. **Configure Alerts**: Set up alerts for application health
4. **Implement Rate Limiting**: Protect against abuse
5. **Add Authentication**: Secure your endpoints with OAuth or API keys
6. **Scale Testing**: Test auto-scaling behavior under load
7. **Cost Optimization**: Monitor usage and adjust scaling parameters

---

**Need Help?** Check the [main README](README.md) or open an issue on GitHub.