import asyncio
import json

from acp_sdk.client import Client
from acp_sdk.models import Message

prompt = json.dumps(
    {
        "city": "Oslo",
        "country": "Norway",
    }
)


async def main() -> None:
    async with Client(
        base_url="http://0.0.0.0:5630",
        headers={},
    ) as client:
        async for event in client.run_stream(
            agent="City_Expert",
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
