"""
Tests for core.openai_client — OpenAI SDK adapter.

Closes GAP-2 (OpenAI client portion) from docs/TEST-COVERAGE-AUDIT.md.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from core import openai_client


def _fake_completion(text: str):
    return MagicMock(choices=[MagicMock(message=MagicMock(content=text))])


def _fake_async_openai(*, response_text=None, stream_chunks=None, raise_exc=None):
    client = MagicMock()
    if raise_exc is not None:
        client.chat.completions.create = AsyncMock(side_effect=raise_exc)
    elif stream_chunks is not None:
        async def _gen():
            for c in stream_chunks:
                yield MagicMock(choices=[MagicMock(delta=MagicMock(content=c))])
        # The streaming create returns an async iterator directly when stream=True
        client.chat.completions.create = AsyncMock(return_value=_gen())
    else:
        client.chat.completions.create = AsyncMock(return_value=_fake_completion(response_text or ""))
    return client


# ---------------------------------------------------------------------------
# call_openai — non-streaming
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_openai_returns_stripped_text():
    fake = _fake_async_openai(response_text="  Hello world  ")
    with patch("core.openai_client.AsyncOpenAI", return_value=fake):
        out = await openai_client.call_openai("hi", "sk-x")
    assert out == "Hello world"


@pytest.mark.asyncio
async def test_call_openai_passes_api_key_to_client():
    fake = _fake_async_openai(response_text="ok")
    with patch("core.openai_client.AsyncOpenAI", return_value=fake) as ctor:
        await openai_client.call_openai("hi", "sk-prj-xyz")
    ctor.assert_called_once_with(api_key="sk-prj-xyz")


@pytest.mark.asyncio
async def test_call_openai_handles_none_content():
    """OpenAI may return None for content (e.g., content filter). Result must still be a string."""
    fake = MagicMock()
    fake.chat.completions.create = AsyncMock(return_value=_fake_completion(None))
    with patch("core.openai_client.AsyncOpenAI", return_value=fake):
        out = await openai_client.call_openai("hi", "sk-x")
    assert out == ""


# ---------------------------------------------------------------------------
# stream_openai — token streaming
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_openai_yields_deltas_in_order():
    fake = _fake_async_openai(stream_chunks=["He", "llo", " world"])
    with patch("core.openai_client.AsyncOpenAI", return_value=fake):
        chunks = [c async for c in openai_client.stream_openai("hi", "sk-x")]
    assert chunks == ["He", "llo", " world"]


@pytest.mark.asyncio
async def test_stream_openai_skips_empty_deltas():
    """A None delta (often the final 'stop' chunk) must not yield."""
    async def _gen():
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content="ok"))])
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content=None))])
        yield MagicMock(choices=[MagicMock(delta=MagicMock(content="done"))])
    fake = MagicMock()
    fake.chat.completions.create = AsyncMock(return_value=_gen())
    with patch("core.openai_client.AsyncOpenAI", return_value=fake):
        chunks = [c async for c in openai_client.stream_openai("hi", "sk-x")]
    assert chunks == ["ok", "done"]
