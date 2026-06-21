# Fleet Register

A lightweight Go HTTP server that monitors IBM Cloud Code Engine fleet workers by tracking their lifecycle events in a CSV file.

## Use Case

This application is deployed as a Code Engine application to monitor fleet workers. Fleet workers call the `/register` endpoint when they start and the `/deregister` endpoint before they shut down. The application maintains a persistent CSV file tracking all worker activity, including registration and completion timestamps.

**Deployment Flow:**
1. Deploy this app as a Code Engine application with persistent storage
2. Configure the fleet with register/deregister hooks pointing to this app
3. Fleet workers automatically report their status throughout their lifecycle

## Endpoints

- `POST /register`
  Creates a row in `fleet-register.csv` with status `running` and records the registration timestamp.

- `POST /deregister`
  Updates the matching row by `worker_name` and `worker_ip` to `completed` and records the completion timestamp.
  If no row exists, it creates a new row with status `completed`.

- `GET /download`
  Downloads the CSV file.

## Request body

```json
{
  "worker_name": "worker-01",
  "worker_ip": "192.168.1.10"
}
```

## Deployment

### Code Engine (Production)

1. **Deploy the application with persistent storage:**
   ```bash
   ibmcloud ce app create --name fleet-workers \
     --build-dockerfile Dockerfile \
     --build-source . \
     --mount-data-store /fleet-workers=fleet-data
   ```

2. **Run fleet with hooks:**
   
   The `run` script automatically retrieves the app URL and creates a fleet with register/deregister hooks:
   ```bash
   ./run
   ```
   
   Or manually create a fleet:
   ```bash
   APP_URL=$(ibmcloud ce app get --name fleet-workers -o url)
   
   PREHOOK="curl -X POST \${APP_URL}/register -H 'Content-Type: application/json' -d '{\"worker_name\":\"\${CE_WORKER_NAME}\",\"worker_ip\":\"\${CE_WORKER_IP}\"}'"
   
   POSTHOOK="curl -X POST \${APP_URL}/deregister -H 'Content-Type: application/json' -d '{\"worker_name\":\"\${CE_WORKER_NAME}\",\"worker_ip\":\"\${CE_WORKER_IP}\"}'"
   
   ibmcloud code-engine fleet create --name my-fleet \
     --tasks-state-store fleet-task-store \
     --subnetpool-name fleet-subnetpool \
     --image registry.access.redhat.com/ubi10/ubi-minimal \
     --max-scale 100 \
     --command="sleep" \
     --arg "30" \
     --tasks 100 \
     --env __CE_INTERNAL_HOOK_AFTER_STARTUP="${PREHOOK}" \
     --env __CE_INTERNAL_HOOK_AFTER_STARTUP_RETRY_LIMIT=3 \
     --env __CE_INTERNAL_HOOK_AFTER_STARTUP_MAX_EXECUTION_TIME=30m \
     --env __CE_INTERNAL_HOOK_BEFORE_SHUTDOWN="${POSTHOOK}" \
     --env __CE_INTERNAL_HOOK_BEFORE_SHUTDOWN_RETRY_LIMIT=3 \
     --env __CE_INTERNAL_HOOK_BEFORE_SHUTDOWN_MAX_EXECUTION_TIME=30m \
     --env APP_URL="${APP_URL}" \
     --cpu 2 \
     --memory 4G
   ```

### Local Development

```bash
go run .
```

Server listens on `:8080`.

### Docker

```bash
docker build -t fleet-register .
docker run -p 8080:8080 -v fleet-data:/fleet-workers fleet-register
```

The CSV file is saved to `/fleet-workers/fleet-register.csv` and persisted in the volume.

## Examples

Register a worker:

```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d '{
    "worker_name": "worker-01",
    "worker_ip": "192.168.1.10"
  }'
```

Deregister a worker:

```bash
curl -X POST http://localhost:8080/deregister \
  -H "Content-Type: application/json" \
  -d '{
    "worker_name": "worker-01",
    "worker_ip": "192.168.1.10"
  }'
```

Download the CSV file:

```bash
curl -O -J http://localhost:8080/download
```

## CSV file

The server automatically creates `fleet-register.csv` in the project root (or `/fleet-workers/` in Docker) if it does not exist.

The CSV file contains the following columns:

- `worker_name` - Name of the worker
- `worker_ip` - IP address of the worker
- `status` - Current status (running/completed)
- `registered_at` - Timestamp when the worker was registered (ISO 8601 format)
- `completed_at` - Timestamp when the worker completed (ISO 8601 format)