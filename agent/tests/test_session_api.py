import pytest
import json
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from main import app


@pytest.fixture
def mock_redis():
    with (
        patch("api.session.get_redis") as mock_factory,
        patch("api.session.load_context", new_callable=AsyncMock) as mock_load,
        patch("api.session.clear_context", new_callable=AsyncMock) as mock_clear,
    ):
        mock_factory.return_value = AsyncMock()
        yield mock_load, mock_clear


@pytest.mark.asyncio
async def test_get_session_returns_empty_for_new_session(mock_redis):
    mock_load, _ = mock_redis
    mock_load.return_value = []

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/session/new-session-id")

    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "new-session-id"
    assert data["turn_count"] == 0
    assert data["history"] == []


@pytest.mark.asyncio
async def test_get_session_returns_correct_turn_count(mock_redis):
    mock_load, _ = mock_redis
    mock_load.return_value = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/session/sess-123")

    assert resp.status_code == 200
    assert resp.json()["turn_count"] == 2


@pytest.mark.asyncio
async def test_delete_session_calls_clear_context(mock_redis):
    mock_load, mock_clear = mock_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.delete("/session/sess-abc")

    assert resp.status_code == 200
    body = resp.json()
    assert body["deleted"] is True
    assert body["session_id"] == "sess-abc"
    mock_clear.assert_called_once()


@pytest.mark.asyncio
async def test_get_session_returns_history_messages(mock_redis):
    mock_load, _ = mock_redis
    mock_load.return_value = [
        {"role": "user", "content": "how many EC2?"},
        {"role": "assistant", "content": "You have 4 EC2 instances."},
    ]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/session/sess-xyz")

    history = resp.json()["history"]
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
