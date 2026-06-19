"""Tests for frontend landing_page module"""

import pytest
from frontend.landing_page import render_landing_page


def test_render_landing_page_basic():
    result = render_landing_page("TestAgent")
    assert "<!DOCTYPE html>" in result
    assert "<title>TestAgent - LangChain Skills Agent</title>" in result
    assert "TestAgent" in result
    assert "LangChain-Powered Skills-Based Agent" in result


def test_render_landing_page_contains_endpoints():
    result = render_landing_page("MyAgent")
    assert "/agents" in result
    assert "/runs" in result
    assert "/info" in result
    assert "/health" in result


def test_render_landing_page_contains_skills():
    result = render_landing_page("MyAgent")
    assert "Weather Forecast" in result
    assert "Travel Recommendations" in result
    assert "Currency Converter" in result
