import asyncio
import json
import os

from acp_sdk.client import Client
from acp_sdk.models import Message

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


async def run_agent(agent_url: str, agent_name: str, input: str) -> list[Message]:
    async with Client(base_url=agent_url) as client:
        run = await client.run_sync(
            agent=agent_name,
            input=[
                Message(
                    parts=[
                        {
                            "content_type": "application/json",
                            "content": input,
                        },
                    ]
                )
            ],
        )

    return run


async def get_hotel_options(destination_json, travel_period, travel_budget_hotel):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            hotel_planner_response = await run_agent(
                agent_url=os.getenv("AGENT_HOTEL_PLANNER_URL"),
                agent_name=os.getenv("AGENT_HOTEL_PLANNER_NAME"),
                input=json.dumps(
                    {
                        "destination": destination_json,
                        "period": travel_period.model_dump(),
                        "budget": travel_budget_hotel,
                    },
                    default=str,
                ),
            )

            hotel_options = hotel_planner_response.output[0].parts[0].content
            return hotel_options  # Success
        except (IndexError, AttributeError, KeyError, TypeError) as e:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Hotel planner agent failed after {MAX_RETRIES} attempts") from e
            await asyncio.sleep(RETRY_DELAY_SECONDS)


async def get_flight_options(travel_origin, destination_json, travel_period, travel_budget_flights):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            flight_planner_response = await run_agent(
                agent_url=os.getenv("AGENT_FLIGHT_PLANNER_URL"),
                agent_name=os.getenv("AGENT_FLIGHT_PLANNER_NAME"),
                input=json.dumps(
                    {
                        "origin": travel_origin.model_dump(),
                        "destination": destination_json,
                        "period": travel_period.model_dump(),
                        "budget": travel_budget_flights,
                    },
                    default=str,
                ),
            )

            flight_options = flight_planner_response.output[0].parts[0].content
            return flight_options  # Success
        except (IndexError, AttributeError, KeyError, TypeError) as e:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Flight planner agent failed after {MAX_RETRIES} attempts") from e
            await asyncio.sleep(RETRY_DELAY_SECONDS)


async def get_travel_guide(destination_json, travel_budget):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            city_expert_response = await run_agent(
                agent_url=os.getenv("AGENT_CITY_EXPERT_URL"),
                agent_name=os.getenv("AGENT_CITY_EXPERT_NAME"),
                input=json.dumps(
                    {
                        **destination_json,
                        "currency": travel_budget.currency,
                    },
                    default=str,
                ),
            )

            travel_guide = city_expert_response.output[0].parts[0].content
            return travel_guide  # Success
        except (IndexError, AttributeError, KeyError, TypeError) as e:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"City expert agent failed after {MAX_RETRIES} attempts") from e
            await asyncio.sleep(RETRY_DELAY_SECONDS)


async def get_city_selection(
    travel_origin,
    travel_destinations,
    travel_period,
    traveler_interests,
    traveler_preferences,
    travel_budget,
):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            city_selection_response = await run_agent(
                agent_url=os.getenv("AGENT_CITY_SELECTION_URL"),
                agent_name=os.getenv("AGENT_CITY_SELECTION_NAME"),
                input=json.dumps(
                    {
                        "travel_origin": travel_origin.model_dump(),
                        "travel_destinations": travel_destinations.model_dump(),
                        "travel_period": travel_period.model_dump(),
                        "traveler_interest": traveler_interests.model_dump(),
                        "traveler_preferences": traveler_preferences.model_dump(),
                        "travel_budget": travel_budget.model_dump(),
                    },
                    default=str,
                ),
            )

            content = city_selection_response.output[0].parts[0].content
            city_selection = json.loads(content)
            return city_selection  # Success
        except (IndexError, AttributeError, KeyError, TypeError, json.JSONDecodeError) as e:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"City selection agent failed after {MAX_RETRIES} attempts") from e
            await asyncio.sleep(RETRY_DELAY_SECONDS)


async def get_itinerary(travel_guide, hotel_options, flight_options):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            itinerary_planner_response = await run_agent(
                agent_url=os.getenv("AGENT_ITINERARY_PLANNER_URL"),
                agent_name=os.getenv("AGENT_ITINERARY_PLANNER_NAME"),
                input=json.dumps(
                    {
                        "travel_guide": travel_guide,
                        "hotel_options": hotel_options,
                        "flight_options": flight_options,
                    },
                    default=str,
                ),
            )

            itinerary = itinerary_planner_response.output[0].parts[0].content
            return itinerary  # Success
        except (IndexError, AttributeError, KeyError, TypeError) as e:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Itinerary planner agent failed after {MAX_RETRIES} attempts") from e
            await asyncio.sleep(RETRY_DELAY_SECONDS)


async def get_budget_breakdown(travel_budget, travel_period):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            budget_planner_response = await run_agent(
                agent_url=os.getenv("AGENT_BUDGET_PLANNER_URL"),
                agent_name=os.getenv("AGENT_BUDGET_PLANNER_NAME"),
                input=json.dumps(
                    {
                        "travel_budget": travel_budget.model_dump(),
                        "travel_period": travel_period.model_dump(),
                    },
                    default=str,
                ),
            )

            budget_breakdown = budget_planner_response.output[0].parts[0].content
            return budget_breakdown  # Success
        except (IndexError, AttributeError, KeyError, TypeError) as e:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"Budget planner agent failed after {MAX_RETRIES} attempts") from e
            await asyncio.sleep(RETRY_DELAY_SECONDS)
