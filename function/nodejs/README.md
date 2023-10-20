# NodeJS Function with additional packages

A sample node.js function that uses a external npm module.

Deploy the function straight to Code Engine by running thr following command from this directory

```bash
ibmcloud ce fn create -n nodejoke -runtime nodejs-18 --build-source .
```

For more information follow th official docs -> [Including modules for a Node.js Function](https://cloud.ibm.com/docs/codeengine?topic=codeengine-fun-create-repo#function-nodejs-dep-repo)

