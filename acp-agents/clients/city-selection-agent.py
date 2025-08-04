import asyncio
import json

from acp_sdk.client import Client
from acp_sdk.models import Message

prompt = json.dumps(
    {
        "travel_origin": {"city": "Stuttgart", "country": "Germany"},
        "travel_destinations": {
            "cities": [
                {"city": "Oslo", "country": "Norway"},
                {"city": "Berlin", "country": "Germany"},
                {"city": "Prague", "country": "Czech Republic"},
                {"city": "Vienna", "country": "Austria"},
                {"city": "Paris", "country": "France"},
                {"city": "Stockholm", "country": "Sweden"},
            ]
        },
        "travel_period": {"from_date": "2025-07-02", "to_date": "2025-07-11"},
        "traveler_interest": {"list": ["sightseeing", "coffee", "family hotel", "restaurants", "activities with kids", "technology trends"]},
        "traveler_preferences": {"list": ["prefers historical sites", "enjoys local cuisine", "avoids crowded tourist traps"]},
        "travel_budget": {"min": "1000", "max": "1800", "currency": "EUR", "currency_symbol": "\u20ac"},
    }
)


async def main() -> None:
    async with Client(
        base_url="http://0.0.0.0:5610",
        headers={},
    ) as client:
        async for event in client.run_stream(
            agent="City_Selection_Expert",
            input=[
                Message(
                    parts=[
                        {
                            "content_type": "application/json",
                            "content": prompt,
                        },
                    ]
                )
            ],
        ):
            try:
                print(event.part.content, end="", flush=True)
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(main())
