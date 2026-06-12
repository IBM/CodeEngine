"""LangChain Agent Configuration

This module configures the LLM and creates the LangChain agent with loaded skills.
Uses the modern approach with tool binding instead of deprecated AgentExecutor.
"""

import logging
import os
from typing import Any, List

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

load_dotenv()

logger = logging.getLogger(__name__)


def create_llm():
    """Create and configure the LLM instance.
    
    Returns:
        Configured ChatOpenAI instance for RedHat AI Inference service
    """
    api_key = os.getenv("IBM_CLOUD_API_KEY")
    base_url = os.getenv("INFERENCE_BASE_URL")
    model = os.getenv("INFERENCE_MODEL_NAME", "llama-3-3-70b-instruct")
    
    logger.info("🔧 CONFIGURING LLM")
    logger.info(f"Base URL: {base_url}")
    logger.info(f"Model: {model}")
    logger.info(f"Temperature: 0.7")
    logger.info(f"Max Tokens: 2048")

    return ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0.7,
    )



def get_system_message() -> str:
    """Get the system message for the agent.
    
    Returns:
        System message string
    """
    return """You are a helpful travel and weather assistant. Your job is to help users plan trips by providing practical, actionable information.

IMPORTANT INSTRUCTIONS:
- When you call tools, WAIT for their results before responding to the user
- Use the actual data returned by the tools in your response
- DO NOT explain what tools you're calling or how you work
- DO NOT mention function calls, APIs, or technical details
- Provide direct, helpful answers based on the tool results
- Format your responses as a helpful travel guide would

Your capabilities:
- Get weather forecasts for any location
- Recommend travel destinations based on preferences and budget
- Convert currencies for travel planning

When helping users:
1. Call the appropriate tools to gather information
2. Wait for the tool results
3. Synthesize the information into a helpful, natural response
4. Present the information as if you're a knowledgeable travel advisor
5. Be friendly, practical, and focus on what the user needs to know

Example good response style:
"Based on the current forecast, Paris will have sunny weather for the next 5 days with temperatures around 22°C. For your $2000 budget (approximately €1,850), I recommend staying in the Marais district where you can find mid-range hotels for about €120/night..."

Example BAD response (never do this):
"I have called the weather_forecast function and the currency_converter function..."

Always provide natural, helpful responses using the actual data from the tools."""


def create_langchain_agent(tools: List):
    """Create a LangChain agent with the provided tools using modern approach.
    
    Args:
        tools: List of LangChain tools (from skills)
    
    Returns:
        LLM instance with tools bound
    """
    llm = create_llm()
    
    logger.info(f"🔗 BINDING {len(tools)} TOOLS TO LLM")
    for tool in tools:
        logger.info(f"  - {tool.name}: {tool.description[:80]}..." if len(tool.description) > 80 else f"  - {tool.name}: {tool.description}")
    
    # Bind tools to the LLM (modern approach)
    llm_with_tools = llm.bind_tools(tools)
    
    return llm_with_tools


def get_agent_info() -> dict:
    """Get information about the configured agent.
    
    Returns:
        Dictionary with agent configuration details
    """
    return {
        "name": "Travel & Weather Assistant",
        "description": "A LangChain-powered agent with weather, travel, and currency conversion skills",
        "model": os.getenv("INFERENCE_MODEL_NAME", "gpt-3.5-turbo"),
        "base_url": os.getenv("INFERENCE_BASE_URL", "Not configured"),
        "version": "1.0.0",
    }

# Made with Bob
