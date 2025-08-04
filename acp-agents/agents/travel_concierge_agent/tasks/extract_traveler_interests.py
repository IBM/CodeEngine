import os

from dotenv import load_dotenv

from classes.task import Model, Task
from schemas import TravelorInterests

load_dotenv()

extract_traveler_interests = Task(
    model=Model(
        base_url=os.getenv("INFERENCE_BASE_URL"),
        api_key=os.getenv("INFERENCE_API_KEY", ""),
        model=os.getenv("INFERENCE_MODEL_NAME"),
        project_id=os.getenv("INFERENCE_PROJECT_ID"),
    ),
    system_prompt="You are an expert in extracting the traveler interests. Extract the interests that the user explicitly mentioned.",
    output_type=TravelorInterests,
)
