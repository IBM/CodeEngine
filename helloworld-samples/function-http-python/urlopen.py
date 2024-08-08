from urllib.request import urlopen, Request
from urllib import parse
import json


def main(params):

    url = "https://httpbin.org"
    request = None

    if params["__ce_method"] == "POST":
        url = url + "/post"
        data = json.dumps(params).encode()
        request = Request(url, data=data, method='POST')
    else:
        url = url + "/get"
        request = Request(url, method='GET')
        

    request.add_header('Content-Type', 'application/json')
    response = urlopen(request)
    data = response.read()
    
    dictData = json.loads(data)

    return {
            "headers": {
                "Content-Type": "application/json",
            },
            "statusCode": response.status,
            "body": dictData
    }