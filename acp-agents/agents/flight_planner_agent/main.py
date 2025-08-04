import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message, MessagePart
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from crewai import Crew
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse

from agents import flight_planner_agent
from frontend.landing_page import render_landing_page
from tasks import create_flight_task
from utils import safe_kickoff

warnings.filterwarnings("ignore")

load_dotenv()

AGENT_NAME = "Flight_Planner"
AGENT_DESCRIPTION = "Find the best flight options from travel origin to travel destination between a start date and end date"


@agent(
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
)
async def flight_agent(
    input: list[Message],
) -> AsyncGenerator[RunYield, RunYieldResume]:
    agent_input = input[0].parts[0].content or ""

    try:
        agent_arguments = json.loads(agent_input)
    except json.JSONDecodeError:
        agent_arguments = {}

    origin = agent_arguments.get("origin")
    destination = agent_arguments.get("destination")
    period = agent_arguments.get("period")
    budget = agent_arguments.get("budget")

    flight_task = create_flight_task(
        origin=f"{origin.get('city')}, {origin.get('country')}",
        destination=f"{destination.get('city')}, {destination.get('country')}",
        from_date=period.get("from_date"),
        to_date=period.get("to_date"),
        budget=f"{budget.get('max')} ({budget.get('currency')})",
        currency=budget.get("currency"),
    )

    crew = Crew(
        agents=[flight_planner_agent],
        tasks=[flight_task],
        verbose=True,
    )

    flight_options = await safe_kickoff(crew)
    yield Message(parts=[MessagePart(content=str(flight_options.raw))])


app = create_app(
    flight_agent,
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
        port=5650,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
        loop="uvloop",
    )


if __name__ == "__main__":
    main()
