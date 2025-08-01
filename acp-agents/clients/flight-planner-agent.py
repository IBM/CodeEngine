import asyncio
import json

from acp_sdk.client import Client
from acp_sdk.models import Message

prompt = json.dumps(
    {
        "origin": {
            "city": "Stuttgart",
            "country": "Germany",
        },
        "destination": {
            "city": "Oslo",
            "country": "Norway",
        },
        "period": {
            "from_date": "2025-07-02",
            "to_date": "2025-07-11",
        },
        "budget": {
            "min": "1000",
            "max": "1800",
            "currency": "EUR",
            "currency_symbol": "€",
        },
    }
)


async def main() -> None:
    async with Client(
        base_url="http://0.0.0.0:5650",
        headers={},
    ) as client:
        async for event in client.run_stream(
            agent="Flight_Planner",
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
