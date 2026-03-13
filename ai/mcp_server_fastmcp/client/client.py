import asyncio
import os
from fastmcp import Client, FastMCP

mcp_server_url = os.getenv("MCP_SERVER_URL", default="http://localhost:8080/mcp")

# HTTP server
client = Client(mcp_server_url)

# Local Python script
#client = Client("../src/main.py")

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

        # Execute operations
        result = await client.call_tool("process_data", {"input": "Hello, FastMCP!"})
        print(result)

asyncio.run(main())