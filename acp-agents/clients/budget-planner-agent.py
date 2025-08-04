import asyncio
import json

from acp_sdk.client import Client
from acp_sdk.models import Message

prompt = json.dumps(
    {
        "travel_budget": {
            "min": 1000,
            "max": 1800,
            "currency": "EUR",
            "currency_symbol": "€",
        },
        "travel_period": {
            "from_date": "2025-07-02",
            "to_date": "2025-07-11",
        },
    }
)


async def main() -> None:
    async with Client(
        base_url="http://0.0.0.0:5620",
        headers={},
    ) as client:
        async for event in client.run_stream(
            agent="Budget_Planner",
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
