import os

from dotenv import load_dotenv

from classes.task import Model, Task
from schemas import TravelorPreferences

load_dotenv()

extract_traveler_preferences = Task(
    model=Model(
        base_url=os.getenv("INFERENCE_BASE_URL"),
        api_key=os.getenv("INFERENCE_API_KEY", ""),
        model=os.getenv("INFERENCE_MODEL_NAME"),
        project_id=os.getenv("INFERENCE_PROJECT_ID"),
    ),
    system_prompt="Extract what the user prefers to do, but ONLY if the user EXPLICITLY mentioned if he or she actually would prefer something. Don't include travel dates, budget or travel orgin or travel destination(s)",
    output_type=TravelorPreferences,
)
