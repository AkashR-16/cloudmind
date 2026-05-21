"""
Tests for core.anthropic_client — Anthropic SDK adapter.

Closes GAP-2 (Anthropic client portion) from docs/TEST-COVERAGE-AUDIT.md.

Mocks the SDK boundary, not the network. The Anthropic SDK contract is the
boundary; if Anthropic changes their API, that's their breakage to surface.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from core import anthropic_client


class _FakeStreamCM:
    """Async context manager mimicking anthropic.AsyncAnthropic().messages.stream()."""
    def __init__(self, chunks):
        self._chunks = chunks

    async def __aenter__(self):
        async def text_stream():
            for c in self._chunks:
                yield c
        self.text_stream = text_stream()
        return self

    async def __aexit__(self, *a):
        return False


def _fake_async_anthropic(*, response_text=None, stream_chunks=None, raise_exc=None):
    """Build a MagicMock that mimics anthropic.AsyncAnthropic just enough."""
    client = MagicMock()
    messages = MagicMock()

    if raise_exc is not None:
        messages.create = AsyncMock(side_effect=raise_exc)
    else:
        msg = MagicMock()
        msg.content = [MagicMock(text=response_text or "")]
        messages.create = AsyncMock(return_value=msg)

    if stream_chunks is not None:
        messages.stream = MagicMock(return_value=_FakeStreamCM(stream_chunks))

    client.messages = messages
    return client


# ---------------------------------------------------------------------------
# call_anthropic — non-streaming
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_anthropic_returns_message_text():
    fake = _fake_async_anthropic(response_text="Hello there  ")
    with patch("core.anthropic_client.anthropic.AsyncAnthropic", return_value=fake):
        result = await anthropic_client.call_anthropic("hi", "sk-ant-key")
    assert result == "Hello there"


@pytest.mark.asyncio
async def test_call_anthropic_passes_api_key_to_client():
    fake = _fake_async_anthropic(response_text="ok")
    with patch("core.anthropic_client.anthropic.AsyncAnthropic", return_value=fake) as ctor:
        await anthropic_client.call_anthropic("hi", "sk-ant-abc")
    ctor.assert_called_once_with(api_key="sk-ant-abc")


@pytest.mark.asyncio
async def test_call_anthropic_propagates_sdk_exceptions():
    fake = _fake_async_anthropic(raise_exc=RuntimeError("anthropic 401"))
    with patch("core.anthropic_client.anthropic.AsyncAnthropic", return_value=fake):
        with pytest.raises(RuntimeError, match="anthropic 401"):
            await anthropic_client.call_anthropic("hi", "bad-key")


# ---------------------------------------------------------------------------
# stream_anthropic — token streaming
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_anthropic_yields_chunks_in_order():
    fake = _fake_async_anthropic(stream_chunks=["Hel", "lo ", "world"])
    with patch("core.anthropic_client.anthropic.AsyncAnthropic", return_value=fake):
        chunks = [c async for c in anthropic_client.stream_anthropic("hi", "sk-ant")]
    assert chunks == ["Hel", "lo ", "world"]


@pytest.mark.asyncio
async def test_stream_anthropic_handles_empty_stream():
    fake = _fake_async_anthropic(stream_chunks=[])
    with patch("core.anthropic_client.anthropic.AsyncAnthropic", return_value=fake):
        chunks = [c async for c in anthropic_client.stream_anthropic("hi", "sk-ant")]
    assert chunks == []
