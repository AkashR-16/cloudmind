"""
Tests for /agent/mode and /agent/test-key endpoints.

Closes GAP-5 from docs/TEST-COVERAGE-AUDIT.md.
"""
import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport

from main import app


# ---------------------------------------------------------------------------
# /agent/mode
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mode_returns_true_when_local_cli_available():
    with patch("api.chat.is_local_mode", return_value=True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/agent/mode")
    assert res.status_code == 200
    assert res.json() == {"local": True}


@pytest.mark.asyncio
async def test_mode_returns_false_when_no_local_cli():
    with patch("api.chat.is_local_mode", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/agent/mode")
    assert res.status_code == 200
    assert res.json() == {"local": False}


# ---------------------------------------------------------------------------
# /agent/test-key
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_test_key_returns_ok_on_valid_key():
    """A successful LLM call must return {ok: True, provider}."""
    with patch("api.chat.call_llm", new_callable=AsyncMock, return_value="pong"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/test-key",
                json={"api_key": "sk-ant-valid", "provider": "anthropic"},
            )
    assert res.status_code == 200
    assert res.json() == {"ok": True, "provider": "anthropic"}


@pytest.mark.asyncio
async def test_test_key_returns_400_on_invalid_key():
    """A failed LLM call must surface the provider's error message in a 400."""
    err = "Error code: 401 - invalid x-api-key"
    with patch("api.chat.call_llm", new_callable=AsyncMock, side_effect=Exception(err)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/test-key",
                json={"api_key": "sk-ant-bad", "provider": "anthropic"},
            )
    assert res.status_code == 400
    assert "invalid x-api-key" in res.json()["detail"]


@pytest.mark.asyncio
async def test_test_key_truncates_long_error_messages():
    """A noisy stack-trace style error must be trimmed to ~240 chars + ellipsis."""
    long_err = "X" * 500
    with patch("api.chat.call_llm", new_callable=AsyncMock, side_effect=Exception(long_err)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/test-key",
                json={"api_key": "sk-x", "provider": "anthropic"},
            )
    detail = res.json()["detail"]
    assert res.status_code == 400
    assert len(detail) <= 241  # 240 + the ellipsis char
    assert detail.endswith("…")


@pytest.mark.asyncio
async def test_test_key_requires_api_key():
    """Missing api_key must yield 422 (Pydantic validation)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/agent/test-key", json={"provider": "anthropic"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_test_key_defaults_provider_to_anthropic():
    """Omitting provider must default to anthropic per the model definition."""
    captured = {}

    async def _capture(prompt, api_key=None, provider=None):
        captured["provider"] = provider
        return "ok"

    with patch("api.chat.call_llm", side_effect=_capture):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/agent/test-key", json={"api_key": "sk-x"})
    assert res.status_code == 200
    assert captured["provider"] == "anthropic"


@pytest.mark.asyncio
async def test_test_key_forwards_provider_to_call_llm():
    """When provider=openai is passed, call_llm must receive provider='openai'."""
    captured = {}

    async def _capture(prompt, api_key=None, provider=None):
        captured["provider"] = provider
        captured["api_key"] = api_key
        return "ok"

    with patch("api.chat.call_llm", side_effect=_capture):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/test-key",
                json={"api_key": "sk-openai", "provider": "openai"},
            )
    assert res.status_code == 200
    assert captured["provider"] == "openai"
    assert captured["api_key"] == "sk-openai"
