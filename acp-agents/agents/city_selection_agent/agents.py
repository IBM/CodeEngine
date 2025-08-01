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

city_research_agent = Agent(
    role="City Research Agent",
    goal="Gather detailed, up-to-date travel information for a specific destination, tailored to a traveler's origin, dates, interests, and budget.",
    backstory=(
        "You are a skilled travel researcher who curates reliable, location-specific data for trip planners. "
        "You find accurate information on attractions, transport, accommodations, and events while factoring in the traveler's interests and budget."
    ),
    reasoning=True,
    verbose=True,
    llm=llm,
)

city_selection_expert_agent = Agent(
    role="City Selection Expert",
    goal="Select the best city based on weather, season, and prices",
    backstory="An expert in analyzing travel data to pick ideal destinations",
    tools=[
        scrape_tool,
        duckduckgosearch_tool,
    ],
    reasoning=True,
    verbose=True,
    llm=llm,
)
