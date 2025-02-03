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