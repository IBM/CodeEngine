# JupyterLab Sample

This example demonstrates how to deploy JupyterLab on IBM Cloud Code Engine. 

## Getting started

Use the following command, to deploy a ready-to-use Jupyter experience:
```
ibmcloud ce app create --name jupyterlab \
    --image "quay.io/jupyter/minimal-notebook:latest" \
    --command "jupyter" \
    --command "lab" \
    --command "--ip" \
    --command "*" \
    --command "--NotebookApp.allow_origin" \
    --command "*" \
    --command "--NotebookApp.token" \
    --command "''" \
    --command "--NotebookApp.password" \
    --command "''" \
    --port 8888
```

## Advanced example

The more advanced configuration, also includes authentication and authorization, as well as the ability to automatially persist all notebooks and configuration. 

By using the setup scripts provided by this example, a solution will be provisioned that comprises of
- OIDC SSO based on GitHub [OAuth apps](https://github.com/settings/developers)
- Persisting the Jupyter workspace in Cloud Object Storage 
- Each user has its own, dedicated Jupyter Notebook instance

![architecture overview](./docs/ce-jupyter.architecture-overview.png)


### Setup script

Following commands can be used to setup a solution as depicted in the architecture diagram shown above:

* Command to initialize the COS instance, the Code Engine project, and the Code Engine persistent data store
```
./run init
```

* Command to add setup a new tenant that provides a dedicated JupyterLab instance. Per tenant, a set of three apps is being deployed.
```
./run deploy <gh-username>
```

* Command to remove a tenant 
```
./run remove <gh-username>
```

* Command to purge everything 
```
./run clean
```

### Configuration parameters

* Following environment variables can be used to tweak the run script

| Name | Description | Default value |
|:----|:---|:---|
| COS_INSTANCE_NAME | Set the name of the COS instance that should host all buckets to persist user data  | `jupyter-labs--cos` |
| REGION | Region of the Code Engine project | `eu-es` |
| RESOURCE_GROUP_NAME | Set the name of the resource group that should contain all artifacts created by this example | `jupyter-labs--rg` |
| VERBOSE | Determine whether debug output should be rendered, or not  | `false` |

