"""LangChain Skills Agent - Main Application

This is the main entry point for the LangChain-based agent with skill-based architecture.
It provides a FastAPI server with ACP SDK integration for agent interactions.
Uses modern LangChain approach with tool binding instead of deprecated AgentExecutor.
"""

import json
import logging
import warnings
from collections.abc import AsyncGenerator

import uvicorn
from acp_sdk.models import Message, MessagePart
from acp_sdk.server import RunYield, RunYieldResume, agent, create_app
from dotenv import load_dotenv
from fastapi.responses import HTMLResponse
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from agents import create_langchain_agent, get_agent_info, get_system_message
from frontend.landing_page import render_landing_page
from skill_loader import discover_skills, get_tools_from_skills, print_skills_summary

warnings.filterwarnings("ignore")

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    
    logger.info("=" * 80)
    logger.info("📨 NEW REQUEST RECEIVED")
    logger.info(f"User Query: {user_message}")
    
    try:
        # Try to parse as JSON if it looks like JSON
        if user_message.strip().startswith("{"):
            try:
                parsed_input = json.loads(user_message)
                # If it's a dict with a 'query' or 'message' field, use that
                if isinstance(parsed_input, dict):
                    user_message = parsed_input.get("query") or parsed_input.get("message") or user_message
                    logger.info(f"Parsed Query: {user_message}")
            except json.JSONDecodeError:
                # Not valid JSON, use as-is
                pass
    except Exception:
        # Any error, just use the original message
        pass
    
    # Invoke the LangChain agent using modern approach with full agentic loop
    try:
        # Create messages for the LLM
        messages = [
            SystemMessage(content=get_system_message()),
            HumanMessage(content=user_message)
        ]
        
        # Agentic loop - iterate until no more tool calls
        max_iterations = 10
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            logger.info(f"\n{'='*80}")
            logger.info(f"🔄 AGENT ITERATION {iteration}/{max_iterations}")
            logger.info(f"{'='*80}")
            
            logger.info("🤖 CALLING INFERENCE SERVICE")
            logger.info(f"Messages in conversation: {len(messages)}")
            logger.info(f"Last message type: {type(messages[-1]).__name__}")
            logger.info(f"Last message preview: {str(messages[-1].content)[:200]}...")
            
            # Invoke the LLM with tools
            response = await llm_with_tools.ainvoke(messages)
            
            logger.info("✅ INFERENCE SERVICE RESPONSE RECEIVED")
            logger.info(f"Response Type: {type(response).__name__}")
            logger.info(f"Has Tool Calls: {bool(response.tool_calls)}")
            
            # Add the assistant's response to messages
            messages.append(response)
            
            # Check if the LLM wants to use tools
            if response.tool_calls:
                logger.info(f"🔧 EXECUTING {len(response.tool_calls)} TOOL CALL(S)")
                
                # Execute tool calls
                for i, tool_call in enumerate(response.tool_calls, 1):
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_call_id = tool_call.get("id", f"call_{i}")
                    
                    logger.info(f"\n  📌 Tool Call {i}/{len(response.tool_calls)}")
                    logger.info(f"     Name: {tool_name}")
                    logger.info(f"     Arguments: {tool_args}")
                    logger.info(f"     ID: {tool_call_id}")
                    
                    if tool_name in tool_map:
                        tool = tool_map[tool_name]
                        try:
                            result = await tool.ainvoke(tool_args)
                            result_str = str(result)
                            logger.info(f"     ✅ Success: {result_str[:150]}..." if len(result_str) > 150 else f"     ✅ Success: {result_str}")
                            
                            # Add tool result to messages using ToolMessage
                            messages.append(
                                ToolMessage(
                                    content=result_str,
                                    tool_call_id=tool_call_id,
                                    name=tool_name
                                )
                            )
                        except Exception as e:
                            error_msg = f"Error calling {tool_name}: {str(e)}"
                            logger.error(f"     ❌ Error: {str(e)}")
                            
                            # Add error as tool result
                            messages.append(
                                ToolMessage(
                                    content=error_msg,
                                    tool_call_id=tool_call_id,
                                    name=tool_name
                                )
                            )
                    else:
                        logger.warning(f"     ⚠️  Tool not found: {tool_name}")
                        messages.append(
                            ToolMessage(
                                content=f"Error: Tool '{tool_name}' not found",
                                tool_call_id=tool_call_id,
                                name=tool_name
                            )
                        )
                
                logger.info(f"\n✓ All tool calls executed. Continuing to next iteration...")
                # Continue loop to let LLM process tool results
                continue
            else:
                # No tool calls, we have the final response
                output = str(response.content) if response.content else "No response generated."
                logger.info(f"\n✅ AGENT LOOP COMPLETE")
                logger.info(f"Total iterations: {iteration}")
                logger.info(f"📤 FINAL OUTPUT: {output[:200]}..." if len(output) > 200 else f"📤 FINAL OUTPUT: {output}")
                logger.info("=" * 80)
                
                # Return the final result
                yield Message(
                    role="agent",
                    parts=[
                        MessagePart(
                            content_type="text/plain",
                            content=output,
                        ),
                    ]
                )
                return
        
        # Max iterations reached
        logger.warning(f"\n⚠️  MAX ITERATIONS ({max_iterations}) REACHED")
        logger.info("=" * 80)
        output = "I apologize, but I've reached the maximum number of processing steps. Please try rephrasing your question or breaking it into smaller parts."
        yield Message(
            role="agent",
            parts=[
                MessagePart(
                    content_type="text/plain",
                    content=output,
                ),
            ]
        )
    except Exception as e:
        # Handle errors gracefully
        logger.error("=" * 80)
        logger.error("❌ ERROR PROCESSING REQUEST")
        logger.error(f"Error Type: {type(e).__name__}")
        logger.error(f"Error Message: {str(e)}")
        logger.error("=" * 80)
        
        error_message = f"❌ Error processing request: {str(e)}\n\nPlease try rephrasing your question or check the agent logs."
        yield Message(
            role="agent",
            parts=[
                MessagePart(
                    content_type="text/plain",
                    content=error_message,
                ),
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
