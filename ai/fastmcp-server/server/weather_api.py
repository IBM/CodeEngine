"""Weather API functions using Open-Meteo API"""
import httpx
from typing import Optional


async def search_location(query: str) -> dict:
    """
    Search for a location using the Open-Meteo Geocoding API.
    
    Args:
        query: Location name to search for
        
    Returns:
        Dictionary containing location search results
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": query, "count": 5, "language": "en", "format": "json"}
        )
        response.raise_for_status()
        return response.json()


async def get_current_weather(latitude: float, longitude: float) -> dict:
    """
    Get current weather for a location using Open-Meteo API.
    
    Args:
        latitude: Latitude of the location
        longitude: Longitude of the location
        
    Returns:
        Dictionary containing current weather data
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                "temperature_unit": "celsius",
                "wind_speed_unit": "kmh",
                "precipitation_unit": "mm"
            }
        )
        response.raise_for_status()
        return response.json()


async def get_weather_forecast(latitude: float, longitude: float, days: int = 7) -> dict:
    """
    Get weather forecast for a location using Open-Meteo API.
    
    Args:
        latitude: Latitude of the location
        longitude: Longitude of the location
        days: Number of days to forecast (default: 7, max: 16)
        
    Returns:
        Dictionary containing weather forecast data
    """
    # Ensure days is within valid range
    days = min(max(1, days), 16)
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
                "temperature_unit": "celsius",
                "wind_speed_unit": "kmh",
                "precipitation_unit": "mm",
                "forecast_days": days
            }
        )
        response.raise_for_status()
        return response.json()


def format_location_results(data: dict) -> str:
    """
    Format location search results into a readable string.
    
    Args:
        data: Location search results from the API
        
    Returns:
        Formatted string with location information
    """
    if "results" not in data or not data["results"]:
        return "No locations found."
    
    results = []
    for location in data["results"]:
        name = location.get("name", "Unknown")
        country = location.get("country", "Unknown")
        admin1 = location.get("admin1", "")
        lat = location.get("latitude", 0)
        lon = location.get("longitude", 0)
        
        location_str = f"{name}"
        if admin1:
            location_str += f", {admin1}"
        location_str += f", {country}"
        location_str += f" (lat: {lat:.4f}, lon: {lon:.4f})"
        
        results.append(location_str)
    
    return "\n".join(results)


def format_current_weather(data: dict) -> str:
    """
    Format current weather data into a readable string.
    
    Args:
        data: Current weather data from the API
        
    Returns:
        Formatted string with current weather information
    """
    if "current" not in data:
        return "No current weather data available."
    
    current = data["current"]
    
    weather_codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    }
    
    weather_code = current.get("weather_code", 0)
    weather_desc = weather_codes.get(weather_code, "Unknown")
    
    result = f"Current Weather:\n"
    result += f"Condition: {weather_desc}\n"
    result += f"Temperature: {current.get('temperature_2m', 'N/A')}°C\n"
    result += f"Feels like: {current.get('apparent_temperature', 'N/A')}°C\n"
    result += f"Humidity: {current.get('relative_humidity_2m', 'N/A')}%\n"
    result += f"Wind Speed: {current.get('wind_speed_10m', 'N/A')} km/h\n"
    result += f"Precipitation: {current.get('precipitation', 'N/A')} mm\n"
    
    return result


def format_weather_forecast(data: dict) -> str:
    """
    Format weather forecast data into a readable string.
    
    Args:
        data: Weather forecast data from the API
        
    Returns:
        Formatted string with weather forecast information
    """
    if "daily" not in data:
        return "No forecast data available."
    
    daily = data["daily"]
    dates = daily.get("time", [])
    
    weather_codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    }
    
    result = "Weather Forecast:\n\n"
    
    for i, date in enumerate(dates):
        weather_code = daily.get("weather_code", [])[i] if i < len(daily.get("weather_code", [])) else 0
        weather_desc = weather_codes.get(weather_code, "Unknown")
        temp_max = daily.get("temperature_2m_max", [])[i] if i < len(daily.get("temperature_2m_max", [])) else "N/A"
        temp_min = daily.get("temperature_2m_min", [])[i] if i < len(daily.get("temperature_2m_min", [])) else "N/A"
        precip = daily.get("precipitation_sum", [])[i] if i < len(daily.get("precipitation_sum", [])) else "N/A"
        precip_prob = daily.get("precipitation_probability_max", [])[i] if i < len(daily.get("precipitation_probability_max", [])) else "N/A"
        wind = daily.get("wind_speed_10m_max", [])[i] if i < len(daily.get("wind_speed_10m_max", [])) else "N/A"
        
        result += f"{date}:\n"
        result += f"  Condition: {weather_desc}\n"
        result += f"  Temperature: {temp_min}°C - {temp_max}°C\n"
        result += f"  Precipitation: {precip} mm (probability: {precip_prob}%)\n"
        result += f"  Max Wind Speed: {wind} km/h\n\n"
    
    return result

# Made with Bob
