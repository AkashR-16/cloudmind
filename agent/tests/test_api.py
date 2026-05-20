import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, MagicMock
from main import app


@pytest.fixture
def mock_pipeline():
    """Patch the full agent pipeline for API integration tests."""
    with (
        patch("api.chat.classify_intent") as mock_intent,
        patch("api.chat.generate_aql") as mock_aql,
        patch("api.chat.get_db") as mock_db,
        patch("api.chat.execute_aql") as mock_exec,
        patch("api.chat.synthesize_stream") as mock_synth,
        patch("api.chat.get_redis") as mock_redis_factory,
        patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
        patch("api.chat.save_context", new_callable=AsyncMock),
    ):
        from core.models import Intent, IntentType
        mock_intent.return_value = Intent(
            type=IntentType.resource_query,
            entities={},
            raw_question="test",
        )
        mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
        mock_exec.return_value = [{"id": "i-123", "kind": "aws_ec2_instance"}]
        mock_load.return_value = []

        async def fake_stream(*args, **kwargs):
            yield "Found 1 EC2 instance."

        mock_synth.side_effect = fake_stream
        mock_redis_factory.return_value = AsyncMock()
        yield


@pytest.mark.asyncio
async def test_chat_returns_200_with_valid_request(mock_pipeline):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/agent/chat",
            json={"message": "Which EC2 instances are running?", "session_id": "test-session"},
        )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_chat_returns_400_for_empty_message():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/agent/chat",
            json={"message": "   ", "session_id": "test-session"},
        )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_chat_returns_422_for_oversized_message():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/agent/chat",
            json={"message": "x" * 2001, "session_id": "test-session"},
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
