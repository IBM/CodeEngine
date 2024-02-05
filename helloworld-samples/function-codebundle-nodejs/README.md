# NodeJS Function with additional packages

A sample nodejs function (main.js) that uses an external npm module referenced by the package.json file. 

Deploy the function straight to Code Engine by running the following command from the source directory 

```bash
ibmcloud ce fn create -n lorem-node -runtime nodejs-18 --build-source .
```

For more information follow the official docs -> [Including modules for a Node.js Function](https://cloud.ibm.com/docs/codeengine?topic=codeengine-fun-create-repo#function-nodejs-dep-repo)

