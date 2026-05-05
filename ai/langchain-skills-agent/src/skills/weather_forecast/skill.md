---
name: "Weather Forecast"
description: "Get current weather and forecast for any location worldwide"
version: "1.0.0"
category: "weather"
parameters:
  - name: location
    type: string
    required: true
    description: "City name (e.g., 'Paris', 'New York') or coordinates"
  - name: days
    type: integer
    required: false
    default: 3
    description: "Number of forecast days (1-7)"
---

# Weather Forecast Skill

This skill provides comprehensive weather information for any location worldwide.

## Features

- Current weather conditions (temperature, humidity, wind speed)
- Multi-day forecast (up to 7 days)
- Weather descriptions and conditions
- Temperature in Celsius and Fahrenheit
- Wind speed and direction
- Humidity and pressure information

## Usage

The skill accepts a location (city name or coordinates) and optionally the number of forecast days.

## Example

```python
result = weather_forecast(location="Paris", days=3)
```

## Output Format

Returns a formatted string with:
- Current conditions
- Daily forecasts with high/low temperatures
- Weather descriptions
- Additional meteorological data

## Notes

- Uses OpenWeatherMap API (or mock data if API key not configured)
- Handles location parsing and validation
- Provides user-friendly error messages for invalid locations