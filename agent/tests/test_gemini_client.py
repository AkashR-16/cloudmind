"""
Tests for core.gemini_client — Google Gemini SDK adapter.

Closes GAP-2 (Gemini client portion) from docs/TEST-COVERAGE-AUDIT.md.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from core import gemini_client


# ---------------------------------------------------------------------------
# call_gemini — non-streaming
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_gemini_returns_stripped_text():
    fake_resp = MagicMock(text="  Hello  ")
    fake_model = MagicMock(generate_content_async=AsyncMock(return_value=fake_resp))
    with (
        patch("core.gemini_client.genai.GenerativeModel", return_value=fake_model),
        patch("core.gemini_client.genai.configure") as configure,
    ):
        out = await gemini_client.call_gemini("hi", "AIza-x")
    assert out == "Hello"
    configure.assert_called_once_with(api_key="AIza-x")


@pytest.mark.asyncio
async def test_call_gemini_propagates_errors():
    fake_model = MagicMock(generate_content_async=AsyncMock(side_effect=RuntimeError("RESOURCE_EXHAUSTED")))
    with (
        patch("core.gemini_client.genai.GenerativeModel", return_value=fake_model),
        patch("core.gemini_client.genai.configure"),
    ):
        with pytest.raises(RuntimeError, match="RESOURCE_EXHAUSTED"):
            await gemini_client.call_gemini("hi", "AIza-x")


# ---------------------------------------------------------------------------
# stream_gemini — token streaming
# ---------------------------------------------------------------------------

class _AsyncIter:
    def __init__(self, items):
        self._items = list(items)
    def __aiter__(self):
        return self
    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)


@pytest.mark.asyncio
async def test_stream_gemini_yields_chunks_with_text():
    chunks_in = [MagicMock(text="Hel"), MagicMock(text="lo"), MagicMock(text=" world")]
    fake_model = MagicMock(generate_content_async=AsyncMock(return_value=_AsyncIter(chunks_in)))
    with (
        patch("core.gemini_client.genai.GenerativeModel", return_value=fake_model),
        patch("core.gemini_client.genai.configure"),
    ):
        chunks = [c async for c in gemini_client.stream_gemini("hi", "AIza-x")]
    assert chunks == ["Hel", "lo", " world"]


@pytest.mark.asyncio
async def test_stream_gemini_skips_empty_text_chunks():
    """If the SDK emits a chunk with empty text, we must not yield it."""
    chunks_in = [MagicMock(text="ok"), MagicMock(text=""), MagicMock(text="done")]
    fake_model = MagicMock(generate_content_async=AsyncMock(return_value=_AsyncIter(chunks_in)))
    with (
        patch("core.gemini_client.genai.GenerativeModel", return_value=fake_model),
        patch("core.gemini_client.genai.configure"),
    ):
        chunks = [c async for c in gemini_client.stream_gemini("hi", "AIza-x")]
    assert chunks == ["ok", "done"]
