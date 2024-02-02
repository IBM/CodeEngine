# Import the pipeline module, which bundles all files in your model directory together
from transformers import pipeline 

# Specify the task and the model directory
translator = pipeline("translation", model="Helsinki-NLP/opus-mt-de-en")

# Translate text "Hallo, wie geht es dir?"
res = translator("Hallo, wie geht es dir?")

# Print the generated text
print(res[0]["translation_text"])