import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from crewai import Crew
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse

from agents import budget_planner_agent
from frontend.landing_page import render_landing_page
from tasks import create_budget_task
from utils import safe_kickoff

warnings.filterwarnings("ignore")

load_dotenv()

AGENT_NAME = "Budget_Planner"
AGENT_DESCRIPTION = "Help travelers allocate their budget effectively across travel categories"


@agent(
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
)
async def budget_agent(
    input: list[Message],
) -> AsyncGenerator[RunYield, RunYieldResume]:
    agent_input = input[0].parts[0].content or ""

    try:
        agent_arguments = json.loads(agent_input)
    except json.JSONDecodeError:
        agent_arguments = {}

    budget = agent_arguments.get("travel_budget")
    period = agent_arguments.get("travel_period")

    budget_task = create_budget_task(
        budget_min=None if budget.get("min") else budget.get("min"),
        budget_max=None if budget.get("max") else budget.get("max"),
        currency=budget.get("currency"),
        period=f"{period.get('from_date') or None} to {period.get('to_date') or None}",
    )

    crew = Crew(
        agents=[budget_planner_agent],
        tasks=[budget_task],
        verbose=True,
    )

    budget_breakdown = await safe_kickoff(crew)

    yield Message(
        parts=[
            {
                "content_type": "application/json",
                "content": budget_breakdown.raw,
            },
        ]
    )


app = create_app(
    budget_agent,
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
        port=5620,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
        loop="uvloop",
    )


if __name__ == "__main__":
    main()
