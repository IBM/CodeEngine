import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message
from acp_sdk.server import Context, RunYield, RunYieldResume, agent, create_app
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse

from frontend.landing_page import render_landing_page
from sub_agents.extract_agent import extract_agent
from utils import get_budget_breakdown, get_city_selection, get_flight_options, get_hotel_options, get_itinerary, get_travel_guide

warnings.filterwarnings("ignore")

load_dotenv()

AGENT_NAME = "Travel_Concierge"
AGENT_DESCRIPTION = "Travel Concierge — a specialist in travel planning and logistics."


def summarize_field(icon, label, value, not_defined=False):
    if not_defined or not value:
        return f"- {icon} {label}: Not defined  \n"
    return f"- {icon} {label}: {value}  \n"


MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


@agent(name=AGENT_NAME, description=AGENT_DESCRIPTION)
async def travel_concierge_agent(input: list[Message], context: Context) -> AsyncGenerator[RunYield, RunYieldResume]:
    user_input = input[0].parts[0].content or ""

    yield "💡 I'm analyzing your request ... "
    yield ""

    """ Extract key information """

    extracted_info = await extract_agent.run(user_input)

    travel_origin, travel_destinations, travel_period, traveler_interests, traveler_preferences, travel_budget = (
        extracted_info.get("origin"),
        extracted_info.get("destinations"),
        extracted_info.get("period"),
        extracted_info.get("interests"),
        extracted_info.get("preferences"),
        extracted_info.get("budget"),
    )

    destinations = [f"{destination.city} ({destination.country})" for destination in travel_destinations.cities]

    yield "🚀 I'm going to plan an itinerary based on the following information:  "

    travel_origin_summary = summarize_field("🏠", "Travel origin", f"{travel_origin.city} ({travel_origin.country})", travel_origin.not_defined)
    travel_destinations_summary = summarize_field("🌆", "Travel destination(s)", ", ".join(destinations), len(destinations) == 0)
    travel_period_summary = summarize_field("📅", "Travel period", f"{travel_period.from_date} - {travel_period.to_date} ({travel_period.nights} nights)", traveler_preferences.not_defined)
    traveler_interests_summary = summarize_field("🚣", "Travel interests", ", ".join(traveler_interests.list), traveler_preferences.not_defined)
    traveler_preferences_summary = summarize_field("🎊", "Travel preferences", ", ".join(traveler_preferences.list), traveler_preferences.not_defined)
    travel_budget_summary = summarize_field("💰", "Travel budget", f"{travel_budget.min} - {travel_budget.max} ({travel_budget.currency})", travel_budget.not_defined)

    list = [
        travel_origin_summary,
        travel_destinations_summary,
        travel_period_summary,
        traveler_interests_summary,
        traveler_preferences_summary,
        travel_budget_summary,
    ]

    yield " ".join(list) + "\n\n"
    yield "🤖 My team of agents is now planning your trip ...  "

    if len(destinations) == 0:
        yield "🤖 My team couldn't find a destination based on your request, please try again  "
        return
    elif len(destinations) > 1:
        yield "\n\n"
        yield "🤖 We see that you have given us multiple travel destinations, we will pick the ideal destination for you.  "
        yield "🤖 I'm handing off the planning to my colleague, the 🤖 City Selection agent.  "

        """ CIT SELECTION AGENT """
        city_selection = await get_city_selection(travel_origin, travel_destinations, travel_period, traveler_interests, traveler_preferences, travel_budget)

        destination = f"{city_selection.get('location').get('city')}, {city_selection.get('location').get('country')}"
        destination_json = city_selection.get("location")

        yield f"🤖 The City Selection agent has a recommendation for you. The selected travel destination for you is {destination}  "
        yield f"{city_selection.get('report').strip().strip('`')}  "
    else:
        destination = destinations[0]
        destination_json = travel_destinations.cities[0].model_dump()

    yield "🤖 I'm handing off the planning to my colleague, the Budget planner agent.  "

    """ BUDGET AGENT """
    budget_breakdown = await get_budget_breakdown(travel_budget, travel_period)
    budget_breakdown_json = json.loads(budget_breakdown)

    budget_flights = budget_breakdown_json.get("flights")
    budget_hotel = budget_breakdown_json.get("accommodation")

    budget_breakdown_chunks = []

    budget_breakdown_chunks.append(f"### Budget: {budget_breakdown_json.get('total')} {travel_budget.currency}  \n")

    for key, value in budget_breakdown_json.items():
        if key != "total":
            budget_breakdown_chunks.append(f"- {key.replace('_', ' ').title()}: {value} {travel_budget.currency}  \n")

    budget_breakdown_chunks.append("  \n")

    yield f"""---
    \n## Travel budget breakdown suggestions

    \n{"".join(budget_breakdown_chunks)}
    \n\n---
    """

    yield f"🤖 I'm handing off the planning to my colleague, the City Expert agent to plan your trip to {destination}.  "

    """ CITY EXPERT AGENT """
    travel_guide = await get_travel_guide(destination_json, travel_budget)

    yield f"🤖 The City Expert agent has created the following travel guide for {destination}.  "
    yield f"{travel_guide.strip().strip('`')}  "

    yield "🤖 We are now looking for hotels ...  "

    travel_budget_hotel = travel_budget.model_dump()
    del travel_budget_hotel["min"]
    travel_budget_hotel["max"] = budget_hotel

    """ HOTEL PLANNER AGENT """
    hotel_options = await get_hotel_options(destination_json, travel_period, travel_budget_hotel)

    yield "🤖 The Hotel agent has found the following hotel information for you ..."
    yield f"""\n{hotel_options.strip().strip("`")}  """
    yield "🤖 We are now looking for flights ...  "

    travel_budget_flights = travel_budget.model_dump()
    del travel_budget_flights["min"]
    travel_budget_flights["max"] = budget_flights

    """ FLIGHT PLANNER AGENT """
    flight_options = await get_flight_options(travel_origin, destination_json, travel_period, travel_budget_flights)

    yield "🤖 The Flight agent has found the following flight information for you ...  "
    yield f"""\n{flight_options.strip().strip("`")}  """
    yield "🤖 We are creating an itinerary for you now ...  "

    """ ITINERARY PLANNER AGENT """
    itinerary = await get_itinerary(travel_guide, hotel_options, flight_options)

    yield "🤖 Here is your itinerary:  "
    yield f"{itinerary.strip().strip('`')}  "

    yield "🤖 Let me know if you want me to plan another trip."

    # TODO: Save itinerary in COS bucket (MCP)


app = create_app(
    travel_concierge_agent,
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
        port=5600,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
        loop="uvloop",
    )


if __name__ == "__main__":
    main()
