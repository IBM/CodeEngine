"""LangChain Skills Agent - Main Application

This is the main entry point for the LangChain-based agent with skill-based architecture.
It provides a FastAPI server with ACP SDK integration for agent interactions.
Uses modern LangChain approach with tool binding instead of deprecated AgentExecutor.
"""

import json
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse
from langchain_core.messages import HumanMessage, SystemMessage

from agents import create_langchain_agent, get_agent_info, get_system_message
from frontend.landing_page import render_landing_page
from skill_loader import discover_skills, get_tools_from_skills, print_skills_summary

warnings.filterwarnings("ignore")

load_dotenv()

# Agent metadata
AGENT_NAME = "Travel_Weather_Assistant"
AGENT_DESCRIPTION = "A LangChain-powered assistant with weather forecasting, travel recommendations, and currency conversion skills. Helps plan trips with real-time information."

# Discover and load skills at startup
print("\n🔍 Discovering skills...")
skills = discover_skills()
print_skills_summary(skills)

# Extract tools for LangChain
tools = get_tools_from_skills(skills)
print(f"✓ Loaded {len(tools)} tool(s) for the agent\n")

# Create the LangChain agent with tools bound
llm_with_tools = create_langchain_agent(tools)

# Create a tool map for easy lookup
tool_map = {tool.name: tool for tool in tools}


@agent(
    name=AGENT_NAME,
    description=AGENT_DESCRIPTION,
)
async def travel_weather_agent(
    input: list[Message],
) -> AsyncGenerator[RunYield, RunYieldResume]:
    """Main agent function that processes user requests.
    
    Args:
        input: List of messages from the user
    
    Yields:
        Response messages with agent results
    """
    # Extract the user's message
    user_message = input[0].parts[0].content or ""
    
    try:
        # Try to parse as JSON if it looks like JSON
        if user_message.strip().startswith("{"):
            try:
                parsed_input = json.loads(user_message)
                # If it's a dict with a 'query' or 'message' field, use that
                if isinstance(parsed_input, dict):
                    user_message = parsed_input.get("query") or parsed_input.get("message") or user_message
            except json.JSONDecodeError:
                # Not valid JSON, use as-is
                pass
    except Exception:
        # Any error, just use the original message
        pass
    
    # Invoke the LangChain agent using modern approach
    try:
        # Create messages for the LLM
        messages = [
            SystemMessage(content=get_system_message()),
            HumanMessage(content=user_message)
        ]
        
        # Invoke the LLM with tools
        response = await llm_with_tools.ainvoke(messages)
        
        # Check if the LLM wants to use tools
        if response.tool_calls:
            # Execute tool calls
            tool_results = []
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                
                if tool_name in tool_map:
                    tool = tool_map[tool_name]
                    try:
                        result = await tool.ainvoke(tool_args)
                        tool_results.append(f"\n{result}\n")
                    except Exception as e:
                        tool_results.append(f"\nError calling {tool_name}: {str(e)}\n")
            
            # Combine tool results
            output = "\n".join(tool_results)
        else:
            # No tool calls, use the LLM's direct response
            output = response.content
        
        # Return the result
        yield Message(
            parts=[
                {
                    "content_type": "text/plain",
                    "content": output,
                },
            ]
        )
    except Exception as e:
        # Handle errors gracefully
        error_message = f"❌ Error processing request: {str(e)}\n\nPlease try rephrasing your question or check the agent logs."
        yield Message(
            parts=[
                {
                    "content_type": "text/plain",
                    "content": error_message,
                },
            ]
        )


# Create the FastAPI app with ACP SDK
app = create_app(
    travel_weather_agent,
    dependencies=[],
)


@app.get(
    "/",
    response_class=HTMLResponse,
    include_in_schema=False,
)
async def landing_page():
    """Serve the landing page."""
    return render_landing_page(name=AGENT_NAME)


@app.get("/info")
async def agent_info():
    """Get information about the agent and loaded skills."""
    agent_data = get_agent_info()
    
    # Add skills information
    skills_info = [
        {
            "name": skill.metadata.name,
            "description": skill.metadata.description,
            "category": skill.metadata.category,
            "version": skill.metadata.version,
        }
        for skill in skills
    ]
    
    return {
        "agent": agent_data,
        "skills": skills_info,
        "skills_count": len(skills),
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agent": AGENT_NAME,
        "skills_loaded": len(skills),
    }


def main():
    """Run the application."""
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        workers=1,
        log_level="info",
        headers=[("server", "acp")],
        reload=True,
    )


if __name__ == "__main__":
    main()

# Made with Bob
