import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from core.redis_client import load_context, save_context, clear_context
from core.models import ChatMessage, MessageRole


def make_messages(n: int) -> list[ChatMessage]:
    msgs = []
    for i in range(n):
        msgs.append(ChatMessage(role=MessageRole.user, content=f"q{i}"))
        msgs.append(ChatMessage(role=MessageRole.assistant, content=f"a{i}"))
    return msgs


@pytest.mark.asyncio
async def test_load_context_returns_empty_when_no_session():
    redis = AsyncMock()
    redis.get.return_value = None
    result = await load_context(redis, "test-session")
    assert result == []


@pytest.mark.asyncio
async def test_load_context_deserialises_messages():
    redis = AsyncMock()
    stored = [{"role": "user", "content": "hello"}, {"role": "assistant", "content": "hi"}]
    redis.get.return_value = json.dumps(stored)
    result = await load_context(redis, "test-session")
    assert len(result) == 2
    assert result[0].role == MessageRole.user
    assert result[1].role == MessageRole.assistant


@pytest.mark.asyncio
async def test_save_context_trims_to_max_turns():
    redis = AsyncMock()
    history = make_messages(15)  # 30 messages = 15 turns
    await save_context(redis, "session", history, max_turns=10, ttl=3600)

    saved_arg = redis.set.call_args[0][1]
    saved = json.loads(saved_arg)
    assert len(saved) == 20  # 10 turns × 2 messages


@pytest.mark.asyncio
async def test_save_context_sets_ttl():
    redis = AsyncMock()
    history = make_messages(2)
    await save_context(redis, "session", history, max_turns=10, ttl=86400)
    call_kwargs = redis.set.call_args[1]
    assert call_kwargs.get("ex") == 86400


@pytest.mark.asyncio
async def test_clear_context_deletes_key():
    redis = AsyncMock()
    await clear_context(redis, "my-session")
    redis.delete.assert_called_once_with("session:my-session")


@pytest.mark.asyncio
async def test_sessions_do_not_bleed():
    redis = AsyncMock()
    redis.get.side_effect = lambda key: (
        json.dumps([{"role": "user", "content": "user A question"}])
        if key == "session:A"
        else None
    )
    result_a = await load_context(redis, "A")
    result_b = await load_context(redis, "B")
    assert len(result_a) == 1
    assert len(result_b) == 0
