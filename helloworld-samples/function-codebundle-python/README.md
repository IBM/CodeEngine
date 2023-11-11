# Python Function with additional modules

A sample Python function that uses a external pip module.

Deploy the function straight to Code Engine by running the following command from this directory

```bash
ibmcloud ce fn create -n lorem-python -runtime python-3.11 --build-source .
```

For more information follow th official docs -> [Including modules for a Python Function](https://cloud.ibm.com/docs/codeengine?topic=codeengine-fun-create-repo#function-python-dep-repo)