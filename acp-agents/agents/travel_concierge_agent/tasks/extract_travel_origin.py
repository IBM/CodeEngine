import os

from dotenv import load_dotenv

from classes.task import Model, Task
from schemas import CityLocation

load_dotenv()

extract_travel_origin = Task(
    model=Model(
        base_url=os.getenv("INFERENCE_BASE_URL"),
        api_key=os.getenv("INFERENCE_API_KEY", ""),
        model=os.getenv("INFERENCE_MODEL_NAME"),
        project_id=os.getenv("INFERENCE_PROJECT_ID"),
    ),
    output_type=CityLocation,
)
