# Python Function with an additional Go binary

A sample Python function which lets you add an additional go binary and call it as part of the function call.

Build the go binary:

```bash
GOOS=linux GOARCH=amd64 go build -o "my-program" -ldflags="-s -w" ./main.go
```

Deploy the function straight to Code Engine by running the following command from this directory

```bash
ibmcloud ce fn create -n py-go-func -runtime python-3.11 --build-source .
```

For more information follow blog -> [IBM Cloud Code Engine: Running Binaries inside the IBM Cloud Code Engine Function Runtimes](https://medium.com/@luke.roy/ibm-cloud-code-engine-running-binarys-inside-the-ibm-cloud-code-engine-function-runtimes-6216e34cad54)
