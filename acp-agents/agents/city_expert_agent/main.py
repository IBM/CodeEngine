import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from crewai import Crew
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse

from agents import city_local_expert_agent
from frontend.landing_page import render_landing_page
from tasks import create_gather_task
from utils import safe_kickoff

warnings.filterwarnings("ignore")

load_dotenv()

AGENT_NAME = "City_Expert"
AGENT_DESCRIPTION = "A culturally aware, detail-oriented travel specialist with deep local knowledge of global destinations. Provides travelers with personalized, on-the-ground insights that go beyond tourist guides."


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

    gather_task = create_gather_task(location=f"{agent_arguments.get('city')}, {agent_arguments.get('country')}", currency=agent_arguments.get("currency"))

    crew = Crew(
        agents=[city_local_expert_agent],
        tasks=[gather_task],
        verbose=True,
    )

    city_guide = await safe_kickoff(crew)

    yield Message(
        parts=[
            {
                "content_type": "application/json",
                "content": city_guide.raw,
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
        port=5630,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
        loop="uvloop",
    )


if __name__ == "__main__":
    main()
