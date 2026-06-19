"""Tests for agents module"""

import os
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def clean_env():
    saved = dict(os.environ)
    yield
    os.environ.clear()
    os.environ.update(saved)


def test_get_system_message():
    from agents import get_system_message

    msg = get_system_message()
    assert isinstance(msg, str)
    assert "travel and weather assistant" in msg.lower()
    assert "IMPORTANT INSTRUCTIONS" in msg


class TestCreateLLM:
    def test_create_llm_with_env_vars(self):
        os.environ["IBM_CLOUD_API_KEY"] = "test-api-key"
        os.environ["INFERENCE_BASE_URL"] = "https://test.example.com"
        os.environ["INFERENCE_MODEL_NAME"] = "test-model"

        with patch("agents.ChatOpenAI") as mock_chat_openai:
            from agents import create_llm

            result = create_llm()
            mock_chat_openai.assert_called_once()
            call_kwargs = mock_chat_openai.call_args[1]
            assert call_kwargs["api_key"] == "test-api-key"
            assert call_kwargs["base_url"] == "https://test.example.com"
            assert call_kwargs["model"] == "test-model"

    def test_create_llm_default_model(self):
        os.environ["IBM_CLOUD_API_KEY"] = "test-api-key"
        os.environ["INFERENCE_BASE_URL"] = "https://test.example.com"

        with patch("agents.ChatOpenAI") as mock_chat_openai:
            from agents import create_llm

            result = create_llm()
            call_kwargs = mock_chat_openai.call_args[1]
            assert call_kwargs["model"] == "llama-3-3-70b-instruct"


class TestCreateLangchainAgent:
    def test_binds_tools_to_llm(self):
        os.environ["IBM_CLOUD_API_KEY"] = "test-api-key"
        os.environ["INFERENCE_BASE_URL"] = "https://test.example.com"

        mock_tool = MagicMock()
        mock_tool.name = "test_tool"
        mock_tool.description = "A test tool"

        with patch("agents.ChatOpenAI") as mock_chat_openai:
            mock_llm = MagicMock()
            mock_llm.bind_tools.return_value = MagicMock()
            mock_chat_openai.return_value = mock_llm

            from agents import create_langchain_agent

            result = create_langchain_agent([mock_tool])
            mock_llm.bind_tools.assert_called_once_with([mock_tool])

    def test_multiple_tools(self):
        os.environ["IBM_CLOUD_API_KEY"] = "test-api-key"
        os.environ["INFERENCE_BASE_URL"] = "https://test.example.com"

        tool1 = MagicMock()
        tool1.name = "tool1"
        tool1.description = "First tool"
        tool2 = MagicMock()
        tool2.name = "tool2"
        tool2.description = "Second tool"

        with patch("agents.ChatOpenAI") as mock_chat_openai:
            mock_llm = MagicMock()
            mock_llm.bind_tools.return_value = MagicMock()
            mock_chat_openai.return_value = mock_llm

            from agents import create_langchain_agent

            result = create_langchain_agent([tool1, tool2])
            mock_llm.bind_tools.assert_called_once_with([tool1, tool2])


class TestGetAgentInfo:
    def test_default_values(self):
        from agents import get_agent_info

        info = get_agent_info()
        assert info["name"] == "Travel & Weather Assistant"
        assert info["model"] == "gpt-3.5-turbo"
        assert info["base_url"] == "Not configured"
        assert info["version"] == "1.0.0"

    def test_with_env_vars(self):
        os.environ["INFERENCE_MODEL_NAME"] = "custom-model"
        os.environ["INFERENCE_BASE_URL"] = "https://custom.example.com"

        from agents import get_agent_info

        info = get_agent_info()
        assert info["model"] == "custom-model"
        assert info["base_url"] == "https://custom.example.com"
