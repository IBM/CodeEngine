import os
from flask import Flask, jsonify

app = Flask(__name__)

# set up root route
@app.route("/")
def hello_world():
    response = {
        "message": "Hello World",
        "status": 200
    }
    return jsonify(response)

# Get the PORT from environment
port = os.getenv('PORT', '8080')
if __name__ == "__main__":
	app.run(host='0.0.0.0',port=int(port))

