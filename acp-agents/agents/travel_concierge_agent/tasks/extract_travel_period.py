import os
from datetime import datetime

from dotenv import load_dotenv

from classes.task import Model, Task
from schemas import TravelPeriod

load_dotenv()

extract_travel_period = Task(
    model=Model(
        base_url=os.getenv("INFERENCE_BASE_URL"),
        api_key=os.getenv("INFERENCE_API_KEY", ""),
        model=os.getenv("INFERENCE_MODEL_NAME"),
        project_id=os.getenv("INFERENCE_PROJECT_ID"),
    ),
    system_prompt=f"You are an expert in extracting the travel period from a user request. Stop and think about whether all necessary information—such as the year—is available. If not, use the current year {datetime.now().year} and fill in any missing details. Today is {datetime.now()}.",
    output_type=TravelPeriod,
)
