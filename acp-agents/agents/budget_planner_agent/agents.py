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

budget_planner_agent = Agent(
    role="Budget Planner",
    goal="Help travelers allocate their budget effectively across travel categories",
    backstory="You are a seasoned travel budget expert who helps people allocate their travel budget wisely across flights, accommodation, activities, food, and other categories based on general rules of thumb and user preferences.",
    tools=[
        scrape_tool,
        duckduckgosearch_tool,
    ],
    reasoning=True,
    verbose=True,
    llm=llm,
)
