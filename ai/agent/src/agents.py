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

city_local_expert_agent = Agent(
    role="Local City Expert",
    goal="Provide the BEST insights about the selected city",
    backstory="A knowledgeable local guide with extensive information about the city, it's attractions and customs",
    tools=[
        scrape_tool,
        duckduckgosearch_tool,
    ],
    reasoning=True,
    verbose=True,
    llm=llm,
)
