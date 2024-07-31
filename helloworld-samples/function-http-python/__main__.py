import http.client, urllib.parse
import json


def main(params):

    url = "httpbin.org"
    connection = http.client.HTTPSConnection(url)

    if params["__ce_method"] == "POST":
        endpoint = "/post"
        connection.request("POST", endpoint, json.dumps(params), {"Content-Type": "application/json"})
    else:
        endpoint = "/get"
        connection.request("GET", endpoint)
    
    
    response = connection.getresponse()
    data = response.read()
    connection.close()
    
    dictData = json.loads(data)

    return {
            "headers": {
                "Content-Type": "application/json",
            },
            "statusCode": response.status,
            "body": dictData
    }