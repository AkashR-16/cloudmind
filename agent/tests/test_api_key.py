"""
Tests for the api_key field on ChatRequest and the 401 guard in /agent/chat.

Covers:
  - 401 returned when not in local mode and no api_key provided
  - 200 returned when api_key is present (even in non-local mode)
  - api_key is forwarded to classify_intent, generate_aql, synthesize_stream
  - Local mode bypasses the 401 guard (Claude CLI available)
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from main import app
from core.models import Intent, IntentType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _yield(*chunks: str):
    for c in chunks:
        yield c


@pytest.fixture
def mock_pipeline_with_key():
    """Full pipeline mock that accepts api_key kwarg forwarding."""
    with (
        patch("api.chat.classify_intent") as mock_intent,
        patch("api.chat.generate_aql") as mock_aql,
        patch("api.chat.get_db"),
        patch("api.chat.execute_aql", return_value=[{"id": "i-123"}]),
        patch("api.chat.synthesize_stream") as mock_synth,
        patch("api.chat.get_redis"),
        patch("api.chat.load_context", new_callable=AsyncMock, return_value=[]),
        patch("api.chat.save_context", new_callable=AsyncMock),
    ):
        mock_intent.return_value = Intent(
            type=IntentType.resource_query, entities={}, raw_question="test"
        )
        mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
        mock_synth.side_effect = lambda *a, **kw: _yield("ok")
        yield {
            "intent": mock_intent,
            "aql": mock_aql,
            "synth": mock_synth,
        }


# ---------------------------------------------------------------------------
# 401 guard — deployed mode (no local Claude CLI)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_returns_401_when_no_local_mode_and_no_api_key():
    """In deployed mode, sending no api_key must return 401."""
    with patch("api.chat.is_local_mode", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/chat",
                json={"message": "List EC2 instances", "session_id": "s1"},
            )
    assert res.status_code == 401
    assert "API key" in res.json()["detail"]


@pytest.mark.asyncio
async def test_returns_401_when_api_key_is_empty_string_in_deployed_mode():
    """An empty string api_key must also trigger 401 in deployed mode."""
    with patch("api.chat.is_local_mode", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/chat",
                json={"message": "List EC2 instances", "session_id": "s1", "api_key": ""},
            )
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# api_key present — request proceeds
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_returns_200_when_api_key_provided_in_deployed_mode(mock_pipeline_with_key):
    """Providing a valid api_key in deployed mode must allow the request through."""
    with patch("api.chat.is_local_mode", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/chat",
                json={
                    "message": "List EC2 instances",
                    "session_id": "s1",
                    "api_key": "AIzaSyFakeKey123",
                },
            )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_api_key_forwarded_to_classify_intent(mock_pipeline_with_key):
    """api_key must be passed as kwarg to classify_intent."""
    with patch("api.chat.is_local_mode", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/agent/chat",
                json={
                    "message": "List EC2 instances",
                    "session_id": "s1",
                    "api_key": "AIzaSyFakeKey123",
                },
            )
    call_kwargs = mock_pipeline_with_key["intent"].call_args
    assert call_kwargs.kwargs.get("api_key") == "AIzaSyFakeKey123"


@pytest.mark.asyncio
async def test_api_key_forwarded_to_generate_aql(mock_pipeline_with_key):
    """api_key must be passed as kwarg to generate_aql."""
    with patch("api.chat.is_local_mode", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/agent/chat",
                json={
                    "message": "List EC2 instances",
                    "session_id": "s1",
                    "api_key": "AIzaSyFakeKey123",
                },
            )
    call_kwargs = mock_pipeline_with_key["aql"].call_args
    assert call_kwargs.kwargs.get("api_key") == "AIzaSyFakeKey123"


@pytest.mark.asyncio
async def test_api_key_forwarded_to_synthesize_stream(mock_pipeline_with_key):
    """api_key must be passed as kwarg to synthesize_stream."""
    with patch("api.chat.is_local_mode", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/agent/chat",
                json={
                    "message": "List EC2 instances",
                    "session_id": "s1",
                    "api_key": "AIzaSyFakeKey123",
                },
            )
    call_kwargs = mock_pipeline_with_key["synth"].call_args
    assert call_kwargs.kwargs.get("api_key") == "AIzaSyFakeKey123"


# ---------------------------------------------------------------------------
# Local mode — 401 guard bypassed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_local_mode_allows_request_without_api_key(mock_pipeline_with_key):
    """In local mode (Claude CLI present), no api_key should still return 200."""
    with patch("api.chat.is_local_mode", return_value=True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/agent/chat",
                json={"message": "List EC2 instances", "session_id": "s1"},
            )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_api_key_field_is_optional_in_request_body():
    """ChatRequest must accept a body without api_key (field is optional)."""
    from core.models import ChatRequest
    req = ChatRequest(message="hello", session_id="s1")
    assert req.api_key is None


@pytest.mark.asyncio
async def test_api_key_field_stored_correctly():
    """ChatRequest must store api_key as provided."""
    from core.models import ChatRequest
    req = ChatRequest(message="hello", session_id="s1", api_key="my-key")
    assert req.api_key == "my-key"


@pytest.mark.asyncio
async def test_api_key_max_length_rejected():
    """api_key longer than 512 chars must be rejected with 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/agent/chat",
            json={"message": "hello", "session_id": "s1", "api_key": "x" * 513},
        )
    assert res.status_code == 422
