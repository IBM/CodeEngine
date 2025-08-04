import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message, MessagePart
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from crewai import Crew
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse

from agents import itinerary_planner_agent
from frontend.landing_page import render_landing_page
from tasks import create_itinerary_task
from utils import safe_kickoff

warnings.filterwarnings("ignore")

load_dotenv()

AGENT_NAME = "Itinerary_Planner"
AGENT_DESCRIPTION = "Trip designer who organizes days for the perfect travel experience."


@agent(
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
)
async def itinerary_agent(
    input: list[Message],
) -> AsyncGenerator[RunYield, RunYieldResume]:
    agent_input = input[0].parts[0].content or ""

    try:
        agent_arguments = json.loads(agent_input)
    except json.JSONDecodeError:
        agent_arguments = {}

    travel_guide = agent_arguments.get("travel_guide")
    hotel_options = agent_arguments.get("hotel_options")
    flight_options = agent_arguments.get("flight_options")

    itinerary_task = create_itinerary_task(
        travel_guide=travel_guide,
        hotel_options=hotel_options,
        flight_options=flight_options,
    )

    crew = Crew(
        agents=[itinerary_planner_agent],
        tasks=[itinerary_task],
        verbose=True,
    )

    itinerary = await safe_kickoff(crew)
    yield Message(parts=[MessagePart(content=str(itinerary.raw))])


app = create_app(
    itinerary_agent,
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
        port=5660,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
        loop="uvloop",
    )


if __name__ == "__main__":
    main()
