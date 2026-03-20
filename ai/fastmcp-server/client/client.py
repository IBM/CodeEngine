import asyncio
import os
from fastmcp import Client, FastMCP

mcp_server_url = os.getenv("MCP_SERVER_URL", default="http://localhost:8080/mcp")

# HTTP server
client = Client(mcp_server_url)

async def main():
    async with client:
        # Basic server interaction
        await client.ping()

        # List available operations
        tools = await client.list_tools()
        print("Available tools:", tools)
        resources = await client.list_resources()
        print("Available resources:", resources)
        prompts = await client.list_prompts()
        print("Available prompts:", prompts)

        # Stuttgart coordinates
        stuttgart_lat = 48.7758
        stuttgart_lon = 9.1829

        print("\n" + "="*50)
        print("WEATHER TOOLS DEMONSTRATION")
        print("="*50)

        # Search for Stuttgart location
        print("\n1. Searching for 'Stuttgart'...")
        result = await client.call_tool("search_location", {"query": "Stuttgart"})
        print(result.content[0].text)

        # Get current weather for Stuttgart
        print("\n2. Getting current weather for Stuttgart...")
        result = await client.call_tool("get_current_weather", {
            "latitude": stuttgart_lat,
            "longitude": stuttgart_lon
        })
        print(result.content[0].text)

        # Get weather forecast for Stuttgart (7 days)
        print("\n3. Getting 7-day weather forecast for Stuttgart...")
        result = await client.call_tool("get_weather_forecast", {
            "latitude": stuttgart_lat,
            "longitude": stuttgart_lon,
            "days": 7
        })
        print(result.content[0].text)

asyncio.run(main())

# Made with Bob
