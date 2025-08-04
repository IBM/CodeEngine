import asyncio

from acp_sdk.client import Client
from acp_sdk.models import Message, MessagePart

prompt = "Create a trip from Stuttgart, Germany to either Oslo, Berlin, Prague, Vienna, Paris or Stockholm from August 10 for 6 days. I'm interested in sightseeing, coffee, family hotel, restaurants, activities with kids and technology trends. My budget is Mid-range (€1000-€1800) and I prefer historical sites, local cuisine, and avoiding crowded tourist traps"
# prompt = "Create a trip from Stuttgart to Oslo from August 10 for 6 days. I'm interested in sightseeing, coffee, family hotel, restaurants, activities with kids and technology trends. My budget is Mid-range (€1000-€1800) and I prefer historical sites, local cuisine, and avoiding crowded tourist traps"


async def main() -> None:
    async with Client(
        base_url="http://0.0.0.0:5600",
        headers={},
    ) as client:
        async for event in client.run_stream(
            agent="Travel_Concierge",
            input=[Message(parts=[MessagePart(content=prompt)])],
        ):
            try:
                if event.type == "generic":
                    if event.generic.reasoning:
                        print("event", event.generic.reasoning)

                else:
                    print(event.part.content, end="", flush=True)
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(main())
