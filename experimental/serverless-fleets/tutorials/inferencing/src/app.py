import argparse
import json
import os
import transformers
from transformers import AutoTokenizer, AutoModelForCausalLM

model_name = 'tiiuae/falcon-7b-instruct'
cache_dir = '/mnt/ce_shared_data'

tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        cache_dir=cache_dir,
        )

model = AutoModelForCausalLM.from_pretrained(
        model_name,
        device_map='auto',
        low_cpu_mem_usage=False,
        cache_dir=cache_dir,
        )

generator = transformers.pipeline(
        'text-generation',
        model=model,
        tokenizer=tokenizer,
        device_map='auto',
        )

parser = argparse.ArgumentParser()
parser.add_argument('input')
args = parser.parse_args()

with open(args.input) as cmdFile:
    for line in cmdFile:
        inPath, outPath = line.split(';', 1)

        with open(inPath) as inFile:
            inputData = json.load(inFile)
            inputData['quantitativeMeasures'] = []

            recipe =' '.join(inputData['directions'])
            prompts = [
                    f'User: extract temperature and duration values for each step of the following recipe. Use the following format for each sentence of the recipe: temperature=..., duration=....\nRecipe:\n{recipe}\n\nAssistant:',
                    f'User: from the following recipe, list temperature and time like: temperature=..., duration=...\n{recipe}\n\nAssistant:',
                    f'User: summarize temperature and time values for this recipe, where applicable in the following format: step1: temperature=..., time=...; step2: etc.\n{recipe}\n\nAssistant:'
            ]


            for idx, prompt in enumerate(prompts):
                outputs = generator(
                        prompt,
                        do_sample=False,
                        max_new_tokens=200,
                        return_full_text=False,
                        truncation=True
                        )
                output_text = outputs[0]['generated_text']

                print(f'output = {output_text}')

                inputData['quantitativeMeasures'].append(output_text)

            os.makedirs(os.path.dirname(outPath), exist_ok=True)
            with open(outPath, 'w') as outFile:
                json.dump(inputData, outFile)