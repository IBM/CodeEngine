# Code Engine CLI Quick Reference

## Project Management
```bash
ibmcloud ce project list                          # List all projects
ibmcloud ce project select --name <name>          # Select a project
ibmcloud ce project current                       # Show current project
ibmcloud ce project create --name <name>          # Create new project
```

## Application Commands
```bash
ibmcloud ce app list                              # List applications
ibmcloud ce app get --name <name>                 # Get app details
ibmcloud ce app create --name <name> --image <img> # Create app
ibmcloud ce app update --name <name> [options]    # Update app
ibmcloud ce app delete --name <name>              # Delete app
ibmcloud ce app logs --application <name> --tail 100 # Get logs
ibmcloud ce app logs --application <name> --follow   # Follow logs
```

## Application Configuration
```bash
# Environment variables
ibmcloud ce app update --name <name> --env KEY=VALUE
ibmcloud ce app update --name <name> --env-from-secret <secret>
ibmcloud ce app update --name <name> --env-from-configmap <cm>

# Scaling
ibmcloud ce app update --name <name> --min-scale 1 --max-scale 10 --concurrency 20

# Resources
ibmcloud ce app update --name <name> --cpu 1 --memory 2G

# Port
ibmcloud ce app update --name <name> --port 8080

# Service binding
ibmcloud ce app bind --name <name> --service-instance <service>
```

## Revision Commands
```bash
ibmcloud ce revision list --application <name>    # List revisions
ibmcloud ce revision get --name <name>            # Get revision details
ibmcloud ce revision delete --name <name>         # Delete revision
```

## Job Commands
```bash
ibmcloud ce job list                              # List jobs
ibmcloud ce job get --name <name>                 # Get job details
ibmcloud ce job create --name <name> --image <img> # Create job
ibmcloud ce job update --name <name> [options]    # Update job
ibmcloud ce jobrun submit --job <name>            # Submit job run
ibmcloud ce jobrun list                           # List job runs
ibmcloud ce jobrun get --name <name>              # Get run details
ibmcloud ce jobrun logs --jobrun <name>           # Get run logs
```

## Secret and ConfigMap Commands
```bash
# Secrets
ibmcloud ce secret list
ibmcloud ce secret create --name <name> --from-literal KEY=VALUE
ibmcloud ce secret create --name <name> --from-file <path>
ibmcloud ce secret update --name <name> --from-literal KEY=VALUE
ibmcloud ce secret delete --name <name>

# ConfigMaps
ibmcloud ce configmap list
ibmcloud ce configmap create --name <name> --from-literal KEY=VALUE
ibmcloud ce configmap update --name <name> --from-literal KEY=VALUE
ibmcloud ce configmap delete --name <name>
```

## Registry Commands
```bash
ibmcloud ce registry list
ibmcloud ce registry create --name <name> --server <server> --username <user> --password <pass>
ibmcloud ce registry delete --name <name>
```

## Build Commands
```bash
ibmcloud ce build list
ibmcloud ce build get --name <name>
ibmcloud ce build create --name <name> --source <git-url> --image <img> --registry-secret <secret>
ibmcloud ce buildrun submit --build <name>
```

## Common Diagnostic Patterns
```bash
# Check if app is healthy
ibmcloud ce app get --name <name> | grep -E "Status|Ready"
ibmcloud ce revision list --application <name>

# Find why app won't deploy
ibmcloud ce app get --name <name>
ibmcloud ce app logs --application <name> --tail 100

# Debug job failure
ibmcloud ce jobrun list --job <name>
ibmcloud ce jobrun get --name <run-name>
ibmcloud ce jobrun logs --jobrun <run-name>

# Verify environment configuration
ibmcloud ce app get --name <name> | grep -A 20 "Environment Variables"
ibmcloud ce secret list

# Check scaling configuration
ibmcloud ce app get --name <name> | grep -E "Min Scale|Max Scale|Concurrency"
```

## Useful Filters with jq
```bash
# Get only app names
ibmcloud ce app list --output json | jq -r '.[].name'

# Get apps with status
ibmcloud ce app list --output json | jq -r '.[] | "\(.name): \(.status)"'

# Get failed job runs
ibmcloud ce jobrun list --output json | jq -r '.[] | select(.status=="Failed") | .name'

# Get revision ready status
ibmcloud ce revision list --application <name> --output json | jq -r '.[] | "\(.name): \(.status)"'
```
