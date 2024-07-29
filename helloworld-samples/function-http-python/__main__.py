import http.client
import json


def main(params):

    url = "httpbin.org"
    endpoint = "/get"
    connection = http.client.HTTPSConnection(url)
    connection.request("GET", endpoint)
    response = connection.getresponse()
    data = response.read()
    connection.close()
    
    dictData = json.loads(data)

    return {
            "headers": {
                "Content-Type": "application/json",
            },
            "statusCode": 200,
            "body": dictData
    }