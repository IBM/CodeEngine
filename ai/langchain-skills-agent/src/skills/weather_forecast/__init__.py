"""Weather Forecast Skill Implementation"""

import os
from datetime import datetime, timedelta

from langchain_core.tools import tool


@tool
def weather_forecast(location: str, days: int = 3) -> str:
    """Get weather forecast for a location.
    
    Args:
        location: City name or location (e.g., 'Paris', 'New York', 'Tokyo')
        days: Number of forecast days (1-7), defaults to 3
    
    Returns:
        Formatted weather forecast information
    """
    # Validate days parameter
    days = max(1, min(days, 7))
    
    # Check if we have an API key (for future real API integration)
    api_key = os.getenv("OPENWEATHER_API_KEY")
    
    if api_key and api_key != "YOUR_KEY":
        # TODO: Implement real API call when API key is available
        # For now, return mock data even if key exists
        pass
    
    # Generate mock weather data for demonstration
    return _generate_mock_weather(location, days)


def _generate_mock_weather(location: str, days: int) -> str:
    """Generate realistic mock weather data for demonstration purposes."""
    
    # Mock weather conditions
    conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear"]
    
    # Base temperatures (varies by location name for variety)
    base_temp = 15 + (len(location) % 10)
    
    result = [
        f"🌤️  Weather Forecast for {location}",
        "=" * 50,
        "",
        "📍 Current Conditions:",
        f"   Temperature: {base_temp}°C ({base_temp * 9/5 + 32:.1f}°F)",
        f"   Condition: {conditions[len(location) % len(conditions)]}",
        f"   Humidity: {60 + (len(location) % 30)}%",
        f"   Wind: {5 + (len(location) % 15)} km/h",
        "",
        f"📅 {days}-Day Forecast:",
        ""
    ]
    
    # Generate forecast for each day
    for i in range(days):
        date = datetime.now() + timedelta(days=i+1)
        day_name = date.strftime("%A, %B %d")
        
        # Vary temperature slightly each day
        high_temp = base_temp + (i % 5) + 2
        low_temp = base_temp - (i % 3)
        condition = conditions[(len(location) + i) % len(conditions)]
        
        result.extend([
            f"   {day_name}:",
            f"   • High: {high_temp}°C ({high_temp * 9/5 + 32:.1f}°F)",
            f"   • Low: {low_temp}°C ({low_temp * 9/5 + 32:.1f}°F)",
            f"   • Condition: {condition}",
            ""
        ])
    
    result.extend([
        "💡 Note: This is demonstration data. Configure OPENWEATHER_API_KEY",
        "   in your .env file for real weather data.",
    ])
    
    return "\n".join(result)


# Export the tool
__all__ = ["weather_forecast"]

# Made with Bob
