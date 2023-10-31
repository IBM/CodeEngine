def main(params):
    msg = 'You did not tell me who you are.'
    if "name" in params:
        msg = f"Hello, {params['name']}!"
    else:
        msg = f"Hello, Functions on Code Engine!"

    return {
        "headers": {
            'Content-Type': 'text/html; charset=utf-8',
        },
        "statusCode": 200,
        "body": f"<html><body><h3>{msg}</h3></body></html>",
    }
