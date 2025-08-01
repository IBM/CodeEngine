import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from crewai import Crew
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse

from agents import city_research_agent, city_selection_expert_agent
from frontend.landing_page import render_landing_page
from tasks import create_city_research_task, create_select_best_city_task, extract_city
from utils import safe_kickoff

warnings.filterwarnings("ignore")

load_dotenv()

AGENT_NAME = "City_Selection_Expert"
AGENT_DESCRIPTION = "An expert in analyzing travel data to pick ideal destinations"


@agent(
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
)
async def city_selection_agent(
    input: list[Message],
) -> AsyncGenerator[RunYield, RunYieldResume]:
    agent_input = input[0].parts[0].content or ""

    try:
        agent_arguments = json.loads(agent_input)
    except json.JSONDecodeError:
        agent_arguments = {}

    travel_origin = agent_arguments.get("travel_origin")
    travel_period = agent_arguments.get("travel_period")
    traveler_interest = agent_arguments.get("traveler_interest")
    traveler_preferences = agent_arguments.get("traveler_preferences")
    travel_budget = agent_arguments.get("travel_budget")
    travel_destinations = agent_arguments.get("travel_destinations")

    research_information = []

    for destination in travel_destinations.get("cities"):
        city_research_task = create_city_research_task(
            destination=None if destination.get("not_defined") else f"{destination.get('city')}, {destination.get('country')}",
            origin=None if travel_origin.get("not_defined") else f"{travel_origin.get('city')}, {travel_origin.get('country')}",
            travel_period=None if travel_period.get("not_defined") else f"{travel_period.get('from_date')} - {travel_period.get('to_date')}",
            interests=None if traveler_interest.get("not_defined") else ", ".join(traveler_interest.get("list")),
            preferences=None if traveler_preferences.get("not_defined") else ", ".join(traveler_preferences.get("list")),
            budget=None if travel_budget.get("not_defined") else f"between {travel_budget.get('min')} and {travel_budget.get('max')} ({travel_budget.get('currency')})",
        )

        crew = Crew(
            agents=[city_research_agent],
            tasks=[city_research_task],
            verbose=True,
        )

        research_task_output = await crew.kickoff_async()
        research_information.append(research_task_output.raw)

    city_options_text = "\n\n".join(f"City option {i + 1}:\n{info}" for i, info in enumerate(research_information))
    city_selection_task = create_select_best_city_task(city_options_text)

    crew = Crew(
        agents=[city_selection_expert_agent],
        tasks=[city_selection_task],
        verbose=True,
    )

    report = await safe_kickoff(crew)

    location = await extract_city.run(f"Extract the city from '{report}'")

    yield Message(
        parts=[
            {
                "content_type": "application/json",
                "content": json.dumps(
                    {
                        "location": {
                            "city": location.city,
                            "country": location.country,
                        },
                        "report": report.raw,
                    }
                ),
            },
        ]
    )


app = create_app(
    city_selection_agent,
    dependencies=[],
)


@app.get(
    "/",
    response_class=HTMLResponse,
    include_in_schema=False,
)
async def landing_page():
    return render_landing_page(name=AGENT_NAME)


def main():
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5610,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
        loop="uvloop",
    )


if __name__ == "__main__":
    main()
