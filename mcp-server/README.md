## Deploying your MCP server on Code Engine

This sample demonstrates 

* Create a new project
```
ibmcloud ce project create --name mcp-demo
```
* Deploy the mcp-proxy server as an app
```
ibmcloud ce app create \
    --name mcp-proxy-stdio-fetch \
    --src "." \
    --command "mcp-proxy" \
    --arg "--pass-environment" \
    --arg "--sse-port=8080" \
    --arg "--sse-host=0.0.0.0" \
    --arg "uvx" \
    --arg "mcp-server-fetch"
```

* Start the inspector
```
npx @modelcontextprotocol/inspector
```

* Download Claude Desktop from https://claude.ai/download


* Obtain the kubeconfig of the project
```
ibmcloud ce proj select -n mcp-demo --kubecfg
```