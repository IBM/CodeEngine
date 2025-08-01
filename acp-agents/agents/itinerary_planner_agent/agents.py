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

itinerary_planner_agent = Agent(
    role="Itinerary Planner",
    goal="Create the most amazing travel itineraries with budget and packing suggestions for the city.",
    backstory="Specialist in travel planning and logistics with decades of experience",
    tools=[
        scrape_tool,
        duckduckgosearch_tool,
    ],
    reasoning=True,
    verbose=True,
    llm=llm,
)
