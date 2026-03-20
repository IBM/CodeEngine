from typing import Any
from fastmcp import FastMCP
import weather_api

mcp = FastMCP(name="Weather MCP Server on Code Engine", instructions="""
OpenWeatherMap MCP Server
        
        This server provides comprehensive and live weather data from OpenWeatherMap API.
        
        Available tools:
        - get_current_weather: Current weather for any location
        - get_forecast: 5-day weather forecast
        - search_location: Find locations by name
""")


@mcp.tool
async def search_location(query: str) -> str:
    """
    Search for a location by name to get coordinates for weather queries.
    
    Args:
        query: The location name to search for (e.g., "London", "New York", "Tokyo")
        
    Returns:
        A formatted string with matching locations and their coordinates
    """
    try:
        data = await weather_api.search_location(query)
        return weather_api.format_location_results(data)
    except Exception as e:
        return f"Error searching for location: {str(e)}"


@mcp.tool
async def get_current_weather(latitude: float, longitude: float) -> str:
    """
    Get the current weather conditions for a specific location.
    
    Args:
        latitude: The latitude of the location (e.g., 51.5074 for London)
        longitude: The longitude of the location (e.g., -0.1278 for London)
        
    Returns:
        A formatted string with current weather information including temperature,
        humidity, wind speed, and precipitation
    """
    try:
        data = await weather_api.get_current_weather(latitude, longitude)
        return weather_api.format_current_weather(data)
    except Exception as e:
        return f"Error getting current weather: {str(e)}"


@mcp.tool
async def get_weather_forecast(latitude: float, longitude: float, days: int = 7) -> str:
    """
    Get the weather forecast for a specific location.
    
    Args:
        latitude: The latitude of the location (e.g., 51.5074 for London)
        longitude: The longitude of the location (e.g., -0.1278 for London)
        days: Number of days to forecast (1-16, default: 7)
        
    Returns:
        A formatted string with daily weather forecast including temperature ranges,
        precipitation, and wind speed
    """
    try:
        data = await weather_api.get_weather_forecast(latitude, longitude, days)
        return weather_api.format_weather_forecast(data)
    except Exception as e:
        return f"Error getting weather forecast: {str(e)}"


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8080)

# Made with Bob
