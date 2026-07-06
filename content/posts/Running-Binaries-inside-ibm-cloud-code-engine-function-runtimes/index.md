---
title: "IBM Cloud Code Engine: Running Binaries inside the IBM Cloud Code Engine Function Runtimes"
date: 2025-01-30
description: "Dunning Binaries inside the IBM Cloud Code Engine Function Runtimes"
tags: ["serverless", "code engine", "functions"]
featureImage: "featured.jpg"
draft: false
authors: ["lukeroy"]
---

In this blog post, we’ll explore how you can use [IBM Cloud Code Engine](https://www.ibm.com/de-de/products/code-engine) to run binaries inside the existing Node.js and Python runtimes.

IBM Cloud Code Engine is IBMs Strategic serverless compute platform that supports a variety of workloads including functions. A function is a stateless code snippet, that perform tasks as it is invoked by HTTP. For Functions, Code Engine currently supports two programming languages: Node.js and Python. But what if you prefer to use a different language?

The solution lies in utilizing one of the existing runtimes, which is provided by IBM Cloud Code Engine. and bundling and executing a binary. In this example, we’ll create a simple function using the Python runtime which will run (`subprocess.run`), a binary written in Go. We’ll leverage the ability to add the binary to the function’s code bundle during the build process.


1. Start by writing a Python function that acts as a wrapper to execute the binary. This wrapper can take the functions parameters and serialize them into a JSON string. The wrapper function will then run the binary, passing the JSON string as a command-line argument. The binary’s output, which will be in JSON format, will be captured and deserialized into a Python dictionary. Finally, this dictionary will be returned as the result of the wrapper function invocation. 

`__main__.py`

```python
import subprocess
import json

output_dict={}
statusCode = 0
binary="my-program"

def main(params):
    command = f'./{binary} \'{json.dumps(params)}\''
    result = subprocess.run(command, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        statusCode = 200
        output_dict = json.loads(result.stdout)
    else:
        statusCode = 500
        output_dict = {"error":"an error as occured"}

    return {
        "headers": {
            'Content-Type': 'application/json; charset=utf-8',
        },
        "statusCode": statusCode,
        "body": output_dict,
    }
```
2. Implement the logic of your application in a Go source file (or multiple). The Go binary must be designed to handle input and output in JSON format. In this example, it should receive a JSON object that contains a key, such as “name”, and return a JSON object that includes the provided value along with additional data. This ensures a clear and consistent interface between the wrapper function and the Go binary. It is up to you to add whatever real world functionality you need inside the Go Code. 

`main.go`

```golang
package main

import (
    "encoding/json"
    "fmt"
    "os"
)

type Response struct {
    Key   string      `json:"key"`
    Value string      `json:"value"`
    Data  interface{} `json:"data"`
}

func main() {
    // recive data as json string and unmarshal into variable
    var inputData map[string]interface{}
    if len(os.Args) > 1 {
        jsonString := os.Args[1]
        err := json.Unmarshal([]byte(jsonString), &inputData)
        if err != nil {
            os.Exit(1)
        }
    }

    // Here comes your logic
    name := "placeholder"
    if len(inputData) != 0 {
        name = inputData["name"].(string)
    }

    // return the response json (to the python code)
    respones := Response{
        Key:   "New Key",
        Value: name,
        Data:  inputData,
    }
    responseJSON, err := json.Marshal(respones)
    if err != nil {
        os.Exit(1)
    }
    fmt.Println(string(responseJSON))
}
````

3. If deploying this setup from the directory where the Go source code is stored, create a `.ceignore` file. This file ensures that only the compiled binary, and not the raw Go source code is included in the function code bundle. This step is useful to exclude any unnecessary files. 

`.ceignore`

```
main.go
```

4. Compile your Go source code into a Go binary. Ensure the build is configured for the target architecture and operating system, for Code Engine this is `linux/amd64`. Proper compilation ensures compatibility and prevents runtime errors.

```bash
GOOS=linux GOARCH=amd64 go build -o "my-program" -ldflags="-s -w" ./main.go
```

Your directory should look like this:
```bash
├── __main__.py
├── main.go
├── .ceignore
└── my-program
```

5. Create your code engine function using the [IBM Cloud Code Engine CLI](https://cloud.ibm.com/docs/codeengine?topic=codeengine-cli) Make sure the binary is in the same directory as the Python function code `__main__.py`. After running the command you will have a code engine function which will execute your go binary as part of the function logic.

```bash
ibmcloud ce fn create - name <function-name> - runtime python-3.11 - build-source .
```

6. You can now call your function using the displayed URL

And that’s it! You have now successfully created a IBM Code Engine Function by deploying your Python wrapper code and your Go binary and executed it on the IBM Cloud.