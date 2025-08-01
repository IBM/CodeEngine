import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message, MessagePart
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from crewai import Crew
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse

from agents import hotel_planner_agent
from frontend.landing_page import render_landing_page
from tasks import create_hotel_task
from utils import safe_kickoff

warnings.filterwarnings("ignore")

load_dotenv()

AGENT_NAME = "Hotel_Planner"
AGENT_DESCRIPTION = "Find comfortable and affordable hotels in travel destination} during start date to end date"


@agent(
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
)
async def hotel_agent(
    input: list[Message],
) -> AsyncGenerator[RunYield, RunYieldResume]:
    agent_input = input[0].parts[0].content or ""

    try:
        agent_arguments = json.loads(agent_input)
    except json.JSONDecodeError:
        agent_arguments = {}

    destination = agent_arguments.get("destination")
    period = agent_arguments.get("period")
    budget = agent_arguments.get("budget")

    hotel_task = create_hotel_task(
        destination=f"{destination.get('city')}, {destination.get('country')}",
        from_date=period.get("from_date"),
        to_date=period.get("to_date"),
        nights=period.get("nights"),
        budget=f"{budget.get('max')} ({budget.get('currency')})",
        currency=budget.get("currency"),
    )

    crew = Crew(
        agents=[hotel_planner_agent],
        tasks=[hotel_task],
        verbose=True,
    )

    hotel_options = await safe_kickoff(crew)
    yield Message(parts=[MessagePart(content=str(hotel_options.raw))])


app = create_app(
    hotel_agent,
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
        port=5640,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
        loop="uvloop",
    )


if __name__ == "__main__":
    main()
