"""Tests for main module"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture(autouse=True)
def clean_env():
    saved = dict(os.environ)
    yield
    os.environ.clear()
    os.environ.update(saved)


@pytest.fixture
def mock_skills():
    tool1 = MagicMock()
    tool1.name = "weather_forecast"
    tool1.description = "Get weather forecast"

    tool2 = MagicMock()
    tool2.name = "currency_converter"
    tool2.description = "Convert currency"

    mock_skill = MagicMock()
    mock_skill.metadata.name = "Weather Forecast"
    mock_skill.metadata.description = "Weather forecast skill"
    mock_skill.metadata.category = "weather"
    mock_skill.metadata.version = "1.0.0"

    return {
        "tools": [tool1, tool2],
        "skills": [mock_skill],
        "tool_map": {t.name: t for t in [tool1, tool2]},
    }


@pytest.fixture
def patched_main(mock_skills):
    with (
        patch("skill_loader.discover_skills", return_value=mock_skills["skills"]),
        patch("skill_loader.get_tools_from_skills", return_value=mock_skills["tools"]),
        patch("skill_loader.print_skills_summary"),
        patch("agents.create_langchain_agent") as mock_create_agent,
    ):
        mock_llm_with_tools = MagicMock()
        mock_create_agent.return_value = mock_llm_with_tools

        import main
        import importlib

        importlib.reload(main)

        yield main, mock_llm_with_tools


class TestMainModule:
    """Test module-level attributes"""

    def test_agent_name(self, patched_main):
        main, _ = patched_main
        assert main.AGENT_NAME == "Travel_Weather_Assistant"

    def test_agent_description(self, patched_main):
        main, _ = patched_main
        assert "LangChain-powered" in main.AGENT_DESCRIPTION

    def test_app_created(self, patched_main):
        main, _ = patched_main
        assert main.app is not None


class TestLandingPage:
    def test_landing_page_returns_html(self, patched_main):
        main, _ = patched_main
        from fastapi.testclient import TestClient

        client = TestClient(main.app)
        response = client.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]


class TestHealthEndpoint:
    def test_health_returns_healthy(self, patched_main):
        main, _ = patched_main
        from fastapi.testclient import TestClient

        client = TestClient(main.app)
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["agent"] == "Travel_Weather_Assistant"


class TestInfoEndpoint:
    def test_info_endpoint(self, patched_main):
        main, _ = patched_main
        from fastapi.testclient import TestClient

        client = TestClient(main.app)
        response = client.get("/info")
        assert response.status_code == 200
        data = response.json()
        assert "agent" in data
        assert "skills" in data
        assert "skills_count" in data


class TestMain:
    def test_main_calls_uvicorn(self):
        with patch("main.uvicorn.run") as mock_run:
            import main

            main.main()
            mock_run.assert_called_once()
            call_kwargs = mock_run.call_args[1]
            assert call_kwargs["host"] == "0.0.0.0"
            assert call_kwargs["port"] == 8080


class TestTravelWeatherAgent:
    def test_simple_query_no_tools(self, patched_main, mock_skills):
        main, mock_llm_with_tools = patched_main

        mock_response = MagicMock()
        mock_response.content = "Here is your travel advice."
        mock_response.tool_calls = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=mock_response)

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="Plan a trip")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None
        assert result.role == "agent"
        assert result.parts[0].content == "Here is your travel advice."

    def test_query_with_tool_calls(self, patched_main, mock_skills):
        main, mock_llm_with_tools = patched_main

        tool_call = {"name": "weather_forecast", "args": {"city": "Paris"}, "id": "call_1"}

        response1 = MagicMock()
        response1.tool_calls = [tool_call]
        response1.content = None

        response2 = MagicMock()
        response2.content = "Paris weather is sunny."
        response2.tool_calls = None

        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[response1, response2])

        mock_tool = mock_skills["tools"][0]
        mock_tool.ainvoke = AsyncMock(return_value="Sunny, 22°C")

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="Weather in Paris?")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None
        assert result.role == "agent"
        assert "Paris" in result.parts[0].content

    def test_json_query_parsing(self, patched_main):
        main, mock_llm_with_tools = patched_main

        mock_response = MagicMock()
        mock_response.content = "Trip planned."
        mock_response.tool_calls = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=mock_response)

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content='{"query": "Plan a trip to Paris"}')])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None
        assert result.role == "agent"

    def test_json_query_with_message_field(self, patched_main):
        main, mock_llm_with_tools = patched_main

        mock_response = MagicMock()
        mock_response.content = "Done."
        mock_response.tool_calls = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=mock_response)

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content='{"message": "Book a flight"}')])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None

    def test_invalid_json_fallback(self, patched_main):
        main, mock_llm_with_tools = patched_main

        mock_response = MagicMock()
        mock_response.content = "Response for bad json."
        mock_response.tool_calls = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=mock_response)

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="{invalid json")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None

    def test_tool_not_found_handling(self, patched_main, mock_skills):
        main, mock_llm_with_tools = patched_main

        tool_call = {"name": "nonexistent_tool", "args": {}, "id": "call_1"}

        response1 = MagicMock()
        response1.tool_calls = [tool_call]
        response1.content = None

        response2 = MagicMock()
        response2.content = "I couldn't find that tool."
        response2.tool_calls = None

        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[response1, response2])

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="Use bad tool")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None

    def test_tool_error_handling(self, patched_main, mock_skills):
        main, mock_llm_with_tools = patched_main

        tool_call = {"name": "weather_forecast", "args": {"city": "Paris"}, "id": "call_1"}

        response1 = MagicMock()
        response1.tool_calls = [tool_call]
        response1.content = None

        response2 = MagicMock()
        response2.content = "Error response."
        response2.tool_calls = None

        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[response1, response2])

        mock_tool = mock_skills["tools"][0]
        mock_tool.ainvoke = AsyncMock(side_effect=RuntimeError("API failure"))

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="Weather?")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None

    def test_error_handling(self, patched_main):
        main, mock_llm_with_tools = patched_main
        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=Exception("Boom"))

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="Anything")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None
        assert result.role == "agent"
        assert "Error" in result.parts[0].content

    def test_max_iterations_reached(self, patched_main, mock_skills):
        main, mock_llm_with_tools = patched_main

        tool_call = {"name": "weather_forecast", "args": {"city": "Paris"}, "id": "call_1"}
        tool_response = MagicMock()
        tool_response.tool_calls = [tool_call]
        tool_response.content = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=tool_response)

        mock_tool = mock_skills["tools"][0]
        mock_tool.ainvoke = AsyncMock(return_value="Sunny")

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="Loop")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None
        assert "maximum number" in result.parts[0].content.lower()

    def test_empty_input_content(self, patched_main):
        main, mock_llm_with_tools = patched_main

        mock_response = MagicMock()
        mock_response.content = "What can I help with?"
        mock_response.tool_calls = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=mock_response)

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content=None)])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None

    def test_json_object_query_field(self, patched_main):
        main, mock_llm_with_tools = patched_main

        mock_response = MagicMock()
        mock_response.content = "Got it."
        mock_response.tool_calls = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=mock_response)

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content='{"query": "What is the weather?"}')])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None

    def test_non_dict_json_fallback(self, patched_main):
        main, mock_llm_with_tools = patched_main

        mock_response = MagicMock()
        mock_response.content = "Response."
        mock_response.tool_calls = None
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=mock_response)

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content='["array", "not", "dict"]')])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None

    def test_multiple_tool_calls(self, patched_main, mock_skills):
        main, mock_llm_with_tools = patched_main

        tool_calls = [
            {"name": "weather_forecast", "args": {"city": "Paris"}, "id": "call_1"},
            {"name": "currency_converter", "args": {"from": "USD", "to": "EUR"}, "id": "call_2"},
        ]

        response1 = MagicMock()
        response1.tool_calls = tool_calls
        response1.content = None

        response2 = MagicMock()
        response2.content = "Paris weather and exchange rates."
        response2.tool_calls = None

        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[response1, response2])

        for t in mock_skills["tools"]:
            t.ainvoke = AsyncMock(return_value="Result")

        from acp_sdk.models import Message, MessagePart

        input_msg = [Message(role="user", parts=[MessagePart(content_type="text/plain", content="Paris and EUR")])]

        result = None

        async def collect():
            nonlocal result
            async for msg in main.travel_weather_agent(input_msg):
                result = msg

        import asyncio

        asyncio.run(collect())

        assert result is not None
