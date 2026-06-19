"""Tests for weather_api module"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import weather_api


@pytest.mark.asyncio
async def test_search_location_success():
    """Test search_location returns raw API response on success"""
    mock_response = {
        "results": [
            {
                "name": "Stuttgart",
                "country": "Germany",
                "admin1": "Baden-Württemberg",
                "latitude": 48.7758,
                "longitude": 9.1829,
            }
        ]
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await weather_api.search_location("Stuttgart")

        assert isinstance(result, dict)
        assert "results" in result
        assert len(result["results"]) == 1
        assert result["results"][0]["name"] == "Stuttgart"
        assert result["results"][0]["country"] == "Germany"


@pytest.mark.asyncio
async def test_search_location_no_results():
    """Test search_location handles empty results"""
    mock_response = {"results": []}

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await weather_api.search_location("NonExistentPlace")

        assert isinstance(result, dict)
        assert "results" in result
        assert result["results"] == []


@pytest.mark.asyncio
async def test_search_location_error():
    """Test search_location raises on HTTP errors"""
    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status.side_effect = Exception(
            "HTTP Error"
        )

        with pytest.raises(Exception, match="HTTP Error"):
            await weather_api.search_location("Stuttgart")


@pytest.mark.asyncio
async def test_get_current_weather_success():
    """Test get_current_weather returns raw API response on success"""
    mock_response = {
        "current": {
            "temperature_2m": 20.5,
            "apparent_temperature": 19.8,
            "relative_humidity_2m": 65,
            "weather_code": 1,
            "wind_speed_10m": 12.5,
            "precipitation": 0.0,
        }
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await weather_api.get_current_weather(48.7758, 9.1829)

        assert isinstance(result, dict)
        assert "current" in result
        assert result["current"]["temperature_2m"] == 20.5
        assert result["current"]["apparent_temperature"] == 19.8
        assert result["current"]["relative_humidity_2m"] == 65


@pytest.mark.asyncio
async def test_get_current_weather_error():
    """Test get_current_weather raises on HTTP errors"""
    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status.side_effect = Exception(
            "HTTP Error"
        )

        with pytest.raises(Exception, match="HTTP Error"):
            await weather_api.get_current_weather(48.7758, 9.1829)


@pytest.mark.asyncio
async def test_get_weather_forecast_success():
    """Test get_weather_forecast returns raw API response on success"""
    mock_response = {
        "daily": {
            "time": ["2024-01-15", "2024-01-16"],
            "weather_code": [0, 1],
            "temperature_2m_max": [22.0, 21.5],
            "temperature_2m_min": [15.0, 14.5],
            "precipitation_sum": [0.0, 2.5],
            "precipitation_probability_max": [10, 50],
            "wind_speed_10m_max": [15.0, 20.0],
        }
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await weather_api.get_weather_forecast(48.7758, 9.1829, 2)

        assert isinstance(result, dict)
        assert "daily" in result
        assert result["daily"]["time"] == ["2024-01-15", "2024-01-16"]
        assert result["daily"]["weather_code"] == [0, 1]
        assert result["daily"]["temperature_2m_max"] == [22.0, 21.5]


@pytest.mark.asyncio
async def test_get_weather_forecast_days_validation():
    """Test get_weather_forecast clamps days to valid range"""
    mock_response = {
        "daily": {
            "time": ["2024-01-15"],
            "weather_code": [0],
            "temperature_2m_max": [22.0],
            "temperature_2m_min": [15.0],
            "precipitation_sum": [0.0],
            "precipitation_probability_max": [10],
            "wind_speed_10m_max": [15.0],
        }
    }

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await weather_api.get_weather_forecast(48.7758, 9.1829, 20)
        assert result["daily"]["time"] == ["2024-01-15"]

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_async_client
        mock_async_client.get = AsyncMock()
        mock_async_client.get.return_value.raise_for_status = MagicMock()
        mock_async_client.get.return_value.json = MagicMock(return_value=mock_response)

        result = await weather_api.get_weather_forecast(48.7758, 9.1829, -5)
        assert result["daily"]["time"] == ["2024-01-15"]


def test_format_location_results():
    """Test format_location_results formats correctly"""
    data = {
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

    result = weather_api.format_location_results(data)

    assert "Berlin" in result
    assert "Germany" in result
    assert "52.5200" in result
    assert "13.4050" in result


def test_format_location_results_empty():
    """Test format_location_results with empty results"""
    data = {"results": []}

    result = weather_api.format_location_results(data)

    assert result == "No locations found."


def test_format_location_results_missing_key():
    """Test format_location_results with missing results key"""
    data = {}

    result = weather_api.format_location_results(data)

    assert result == "No locations found."


def test_format_current_weather():
    """Test format_current_weather formats correctly"""
    data = {
        "current": {
            "temperature_2m": 25.0,
            "apparent_temperature": 24.5,
            "relative_humidity_2m": 70,
            "weather_code": 0,
            "wind_speed_10m": 10.0,
            "precipitation": 0.0,
        }
    }

    result = weather_api.format_current_weather(data)

    assert "Current Weather:" in result
    assert "Clear sky" in result
    assert "25.0°C" in result
    assert "24.5°C" in result
    assert "70%" in result
    assert "10.0 km/h" in result
    assert "0.0 mm" in result


def test_format_current_weather_missing_data():
    """Test format_current_weather with missing current data"""
    data = {}

    result = weather_api.format_current_weather(data)

    assert result == "No current weather data available."


def test_format_current_weather_unknown_code():
    """Test format_current_weather with unknown weather code falls back to Unknown"""
    data = {
        "current": {
            "temperature_2m": 20.0,
            "apparent_temperature": 19.0,
            "relative_humidity_2m": 50,
            "weather_code": 999,
            "wind_speed_10m": 5.0,
            "precipitation": 0.0,
        }
    }

    result = weather_api.format_current_weather(data)

    assert "Current Weather:" in result
    assert "Unknown" in result
    assert "20.0°C" in result


def test_format_weather_forecast():
    """Test format_weather_forecast formats correctly"""
    data = {
        "daily": {
            "time": ["2024-01-15", "2024-01-16"],
            "weather_code": [0, 1],
            "temperature_2m_max": [22.0, 21.0],
            "temperature_2m_min": [15.0, 14.0],
            "precipitation_sum": [0.0, 5.0],
            "precipitation_probability_max": [10, 60],
            "wind_speed_10m_max": [15.0, 20.0],
        }
    }

    result = weather_api.format_weather_forecast(data)

    assert "Weather Forecast:" in result
    assert "2024-01-15" in result
    assert "2024-01-16" in result
    assert "Clear sky" in result
    assert "Mainly clear" in result


def test_format_weather_forecast_missing_data():
    """Test format_weather_forecast with missing daily data"""
    data = {}

    result = weather_api.format_weather_forecast(data)

    assert result == "No forecast data available."


def test_format_weather_forecast_edge_cases():
    """Test format_weather_forecast with mismatched array lengths"""
    data = {
        "daily": {
            "time": ["2024-01-15", "2024-01-16", "2024-01-17"],
            "weather_code": [0],
            "temperature_2m_max": [22.0],
            "temperature_2m_min": [15.0],
            "precipitation_sum": [0.0],
            "precipitation_probability_max": [10],
            "wind_speed_10m_max": [15.0],
        }
    }

    result = weather_api.format_weather_forecast(data)

    assert "2024-01-15" in result
    assert "2024-01-16" in result
    assert "2024-01-17" in result
    assert "N/A" in result


def test_format_weather_forecast_unknown_code():
    """Test format_weather_forecast with unknown weather code falls back to Unknown"""
    data = {
        "daily": {
            "time": ["2024-01-15"],
            "weather_code": [999],
            "temperature_2m_max": [22.0],
            "temperature_2m_min": [15.0],
            "precipitation_sum": [0.0],
            "precipitation_probability_max": [10],
            "wind_speed_10m_max": [15.0],
        }
    }

    result = weather_api.format_weather_forecast(data)

    assert "Unknown" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
