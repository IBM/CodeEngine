from dotenv import load_dotenv
from litellm import completion
from pydantic import BaseModel

from schemas import Model

load_dotenv()


class Task:
    def __init__(self, model: Model, system_prompt: str = None, output_type: BaseModel = None):
        self.model = model
        self.system_prompt = system_prompt
        self.output_type = output_type

    async def run(self, user_prompt: str):
        messages = []

        if self.system_prompt:
            messages.append(
                {
                    "content": self.system_prompt,
                    "role": "system",
                }
            )

        messages.append(
            {
                "content": user_prompt,
                "role": "user",
            }
        )

        response = completion(
            base_url=self.model.base_url,
            api_key=self.model.api_key,
            model=self.model.model,
            messages=messages,
            project_id=self.model.project_id,
            temperature=0,
            extra_body={
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "response-schema",
                        "strict": True,
                        "schema": self.output_type.model_json_schema(),
                    },
                }
            },
        )

        return self.output_type.model_validate_json(response.choices[0].message.content)
