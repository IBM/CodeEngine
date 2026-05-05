"""LangChain Agent Configuration

This module configures the LLM and creates the LangChain agent with loaded skills.
Uses the modern approach with tool binding instead of deprecated AgentExecutor.
"""

import os
from typing import Any, List

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_ibm import ChatWatsonx

load_dotenv()


def create_llm():
    """Create and configure the LLM instance.
    
    Returns:
        Configured ChatWatsonx instance
    """

    parameters = {
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    return ChatWatsonx(
        model_id=os.getenv("INFERENCE_MODEL_NAME", "gpt-3.5-turbo"),
        url=os.getenv("INFERENCE_BASE_URL"),
        api_key=os.getenv("INFERENCE_API_KEY", ""),
        project_id=os.getenv("INFERENCE_PROJECT_ID"),
        params=parameters
    )



def get_system_message() -> str:
    """Get the system message for the agent.
    
    Returns:
        System message string
    """
    return """You are a helpful travel and weather assistant with access to specialized skills.

Your capabilities include:
- Providing weather forecasts for any location
- Recommending travel destinations based on preferences
- Converting currencies for travel planning

When users ask questions:
1. Understand their needs clearly
2. Use the appropriate skills to gather information
3. Provide comprehensive, well-formatted responses
4. Be friendly and helpful

Always format your responses in a clear, readable way. Use the skills available to you to provide accurate and helpful information."""


def create_langchain_agent(tools: List):
    """Create a LangChain agent with the provided tools using modern approach.
    
    Args:
        tools: List of LangChain tools (from skills)
    
    Returns:
        LLM instance with tools bound
    """
    llm = create_llm()
    
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
