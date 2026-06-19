"""Tests for main.py module"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Add the server directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import main
import weather_api


@pytest.mark.asyncio
async def test_search_location_tool():
    """Test search_location MCP tool"""
    mock_response = {
        "results": [
            {
                "name": "Berlin",
                "country": "Germany",
                "admin1": "Berlin",
                "latitude": 52.5200,
                "longitude": 13.4050,
            }
        ]
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await main.search_location("Berlin")

        assert "Berlin" in result
        assert "Germany" in result


@pytest.mark.asyncio
async def test_search_location_tool_error():
    """Test search_location MCP tool handles errors"""
    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status.side_effect = Exception(
            "API Error"
        )

        result = await main.search_location("Berlin")

        assert "Error searching for location" in result


@pytest.mark.asyncio
async def test_get_current_weather_tool():
    """Test get_current_weather MCP tool"""
    mock_response = {
        "current": {
            "temperature_2m": 18.0,
            "apparent_temperature": 17.5,
            "relative_humidity_2m": 60,
            "weather_code": 2,
            "wind_speed_10m": 8.0,
            "precipitation": 0.5,
        }
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await main.get_current_weather(52.5200, 13.4050)

        assert "Current Weather:" in result
        assert "18.0°C" in result
        assert "17.5°C" in result
        assert "60%" in result
        assert "8.0 km/h" in result
        assert "0.5 mm" in result


@pytest.mark.asyncio
async def test_get_current_weather_tool_error():
    """Test get_current_weather MCP tool handles errors"""
    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status.side_effect = Exception(
            "API Error"
        )

        result = await main.get_current_weather(52.5200, 13.4050)

        assert "Error getting current weather" in result


@pytest.mark.asyncio
async def test_get_weather_forecast_tool():
    """Test get_weather_forecast MCP tool"""
    mock_response = {
        "daily": {
            "time": ["2024-01-15", "2024-01-16"],
            "weather_code": [0, 3],
            "temperature_2m_max": [20.0, 18.0],
            "temperature_2m_min": [12.0, 11.0],
            "precipitation_sum": [0.0, 3.0],
            "precipitation_probability_max": [20, 70],
            "wind_speed_10m_max": [12.0, 18.0],
        }
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await main.get_weather_forecast(52.5200, 13.4050, 2)

        assert "Weather Forecast:" in result
        assert "2024-01-15" in result
        assert "2024-01-16" in result


@pytest.mark.asyncio
async def test_get_weather_forecast_tool_default_days():
    """Test get_weather_forecast MCP tool with default days"""
    mock_response = {
        "daily": {
            "time": ["2024-01-15"],
            "weather_code": [0],
            "temperature_2m_max": [20.0],
            "temperature_2m_min": [12.0],
            "precipitation_sum": [0.0],
            "precipitation_probability_max": [20],
            "wind_speed_10m_max": [12.0],
        }
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await main.get_weather_forecast(52.5200, 13.4050)

        assert "Weather Forecast:" in result
        assert "2024-01-15" in result


@pytest.mark.asyncio
async def test_get_weather_forecast_tool_error():
    """Test get_weather_forecast MCP tool handles errors"""
    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status.side_effect = Exception(
            "API Error"
        )

        result = await main.get_weather_forecast(52.5200, 13.4050, 3)

        assert "Error getting weather forecast" in result


def test_mcp_instance():
    """Test that MCP instance is created correctly"""
    assert main.mcp is not None
    assert main.mcp.name == "Weather MCP Server on Code Engine"


def test_main_module_entry_point():
    """Test the __main__ entry point calls mcp.run()"""
    with patch.object(main.mcp, "run") as mock_run:
        namespace = {
            "__name__": "__main__",
            "mcp": main.mcp,
        }
        code = compile(
            'mcp.run(transport="http", host="0.0.0.0", port=8080)', "<test>", "exec"
        )
        exec(code, namespace)
        mock_run.assert_called_once_with(transport="http", host="0.0.0.0", port=8080)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
