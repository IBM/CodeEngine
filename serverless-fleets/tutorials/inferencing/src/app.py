import argparse
import os
import json
import time
from vllm import LLM, SamplingParams

access_token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
task_index = os.getenv("CE_TASK_INDEX")
#model_name = 'tiiuae/falcon-7b-instruct'
model_name = os.getenv("MODEL_NAME", "ibm-granite/granite-4.0-h-small")

parser = argparse.ArgumentParser()
parser.add_argument('input')
args = parser.parse_args()

def run_conversation():
    start_download_time = time.perf_counter()

    llm = LLM(model=model_name, quantization="fp8")  # or "int8" if supported
    end_download_time = time.perf_counter()
    print(f"Model initilization completed in {end_download_time - start_download_time:.2f} seconds")

    prompts = []
    with open(args.input, 'r', encoding='utf-8') as file:
        for inPath in file:
            with open(inPath.rstrip()) as inFile:
                inputData = json.load(inFile)
                inputData['quantitativeMeasures'] = []

                recipe =' '.join(inputData['directions'])
                prompt = f'User: extract temperature and duration values for each step of the following recipe. Use the following format for each sentence of the recipe: temperature=..., duration=....\nRecipe:\n{recipe}\n\nAssistant:'
                prompts.append(prompt)

        sampling_params = SamplingParams(max_tokens=300)

        start_time = time.perf_counter()
        outputs = llm.generate(prompts, sampling_params)
        end_time = time.perf_counter()

        print(f"Batch inferencing completed in {end_time - start_time:.2f} seconds")

        start_time_output = time.perf_counter()
        # iterate through the outputs of each prompt
        results = []
        for i, output in enumerate(outputs):
            result = {
                "input": prompts[i],
                "output": output.outputs[0].text
            }
            results.append(result)
        
        # write output to a single file for the whole batch 
        output_path = "/output/inferencing_vllm_task-%s.jsonl" % task_index
        with open(output_path, 'w', encoding='utf-8') as out_file:
            out_file.write(json.dumps(results) + "\n")
        end_time_output = time.perf_counter()

        print(f"Writing outputs completed in {end_time_output - start_time_output:.2f} seconds")

if __name__ == "__main__":
    run_conversation()

