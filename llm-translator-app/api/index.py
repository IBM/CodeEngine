from flask import Flask, request, jsonify
from transformers import pipeline 
import logging
import sys

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG, format='%(asctime)s.%(msecs)03d %(levelname)s %(module)s - %(funcName)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger(__name__)

# Init the model (https://huggingface.co/Helsinki-NLP/opus-mt-de-en)
log.debug("pipeline de->en init ...")
de_to_en_translator = pipeline("translation", model="Helsinki-NLP/opus-mt-de-en") 
log.debug("pipeline de->en init [done]")

app = Flask(__name__)

@app.route("/api/ping")
def simple_ping():
    log.debug("works")
    return jsonify({"message":"ok"})

# Set up a route at /api/translate/de-en
@app.route('/api/translate/de-en', methods=['POST'])
def translate_to_en():
    log.debug(">")
    data = request.json
    # run the translation operation
    res = de_to_en_translator(data["text"])
    # return text back to user
    log.debug("< done")
    return jsonify({"translated":(res[0]["translation_text"])})

# Start the Flask server
port = '5328'
if __name__ == "__main__":
	app.run(host='0.0.0.0',port=int(port))