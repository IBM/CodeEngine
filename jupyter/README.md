# JupyterLab Sample

This example provides an end-to-end running solution that provides JupyterLab hosted on IBM Cloud Code Engine. 

The solution comprises of 
- OIDC SSO based on GitHub OAuthApps
- Storing JupyterLabs state in COS 
- Each Jupter user uses its own Jupyter Notebook instance


![architecture overview](./docs/ce-jupyter.architecture-overview.png)

## Setting up the example

* Command to initialize the COS instance, the Code Engine project, and the Code Engine persistent data store
```
./run init
```

* Command to add setup a new tenant that provides a dedicated JupyterLab instance
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

* Following environment variables can be used to tweak the run script

| Name | Description | Default value |
|:----|:---|:---|
| REGION | Region of the Code Engine project | `eu-es` |
| VERBOSE | Determine whether debug output should be rendered, or not  | `false` |

