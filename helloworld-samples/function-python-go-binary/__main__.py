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