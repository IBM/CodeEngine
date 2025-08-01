import os

from crewai import LLM, Agent
from dotenv import load_dotenv

from tools import duckduckgosearch_tool, scrape_tool

load_dotenv()

llm = LLM(
    model=os.getenv("INFERENCE_MODEL_NAME"),
    base_url=os.getenv("INFERENCE_BASE_URL"),
    api_key=os.getenv("INFERENCE_API_KEY", ""),
    project_id=os.getenv("INFERENCE_PROJECT_ID"),
    max_tokens=8192,
    temperature=0,
)

hotel_planner_agent = Agent(
    role="Hotel Planner",
    goal="Book comfortable and well-located hotels within the user's budget",
    backstory="You specialize in hotel bookings, from boutique hotels to luxury resorts. You consider location, amenities, and reviews.",
    tools=[
        scrape_tool,
        duckduckgosearch_tool,
    ],
    reasoning=True,
    verbose=True,
    llm=llm,
)
