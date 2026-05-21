"""
Tests for core.llm_router — the dev/prod LLM switch and provider routing.

Closes GAP-2 (router portion) from docs/TEST-COVERAGE-AUDIT.md.
"""
import pytest
from unittest.mock import patch, AsyncMock

from core import llm_router


# ---------------------------------------------------------------------------
# is_local_mode — detection of the Claude CLI
# ---------------------------------------------------------------------------

def _reset_probe():
    """The router caches its CLI probe — reset it between tests."""
    llm_router._claude_bin = None
    llm_router._probed = False


def test_is_local_mode_true_when_claude_binary_found():
    _reset_probe()
    with patch("core.llm_router._find_claude", return_value="/usr/local/bin/claude"):
        assert llm_router.is_local_mode() is True


def test_is_local_mode_false_when_no_claude_binary():
    _reset_probe()
    with patch("core.llm_router._find_claude", return_value=None):
        assert llm_router.is_local_mode() is False


def test_is_local_mode_caches_probe_result():
    """The probe must run exactly once even when called repeatedly."""
    _reset_probe()
    finder = patch("core.llm_router._find_claude", return_value="/usr/local/bin/claude")
    with finder as mock:
        llm_router.is_local_mode()
        llm_router.is_local_mode()
        llm_router.is_local_mode()
    assert mock.call_count == 1


# ---------------------------------------------------------------------------
# call_llm — provider routing matrix
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_llm_routes_to_anthropic_when_provider_anthropic():
    with patch("core.anthropic_client.call_anthropic", new_callable=AsyncMock, return_value="anthropic-out") as m:
        result = await llm_router.call_llm("hello", api_key="sk-ant-x", provider="anthropic")
    assert result == "anthropic-out"
    m.assert_awaited_once_with("hello", "sk-ant-x")


@pytest.mark.asyncio
async def test_call_llm_routes_to_openai_when_provider_openai():
    with patch("core.openai_client.call_openai", new_callable=AsyncMock, return_value="openai-out") as m:
        result = await llm_router.call_llm("hello", api_key="sk-x", provider="openai")
    assert result == "openai-out"
    m.assert_awaited_once_with("hello", "sk-x")


@pytest.mark.asyncio
async def test_call_llm_routes_to_gemini_when_provider_gemini():
    with patch("core.gemini_client.call_gemini", new_callable=AsyncMock, return_value="gem-out") as m:
        result = await llm_router.call_llm("hello", api_key="AIza-x", provider="gemini")
    assert result == "gem-out"
    m.assert_awaited_once_with("hello", "AIza-x")


@pytest.mark.asyncio
async def test_call_llm_defaults_to_gemini_when_provider_unspecified():
    """If api_key is set but provider is None, route to Gemini (current default)."""
    with patch("core.gemini_client.call_gemini", new_callable=AsyncMock, return_value="gem-out") as m:
        result = await llm_router.call_llm("hello", api_key="AIza-x", provider=None)
    assert result == "gem-out"
    m.assert_awaited_once()


@pytest.mark.asyncio
async def test_call_llm_uses_claude_cli_when_no_key_and_local_mode():
    _reset_probe()
    with (
        patch("core.llm_router._find_claude", return_value="/bin/claude"),
        patch("core.claude_client.call_claude", new_callable=AsyncMock, return_value="cli-out") as m,
    ):
        result = await llm_router.call_llm("hello")
    assert result == "cli-out"
    m.assert_awaited_once_with("hello")


@pytest.mark.asyncio
async def test_call_llm_raises_no_api_key_in_deployed_mode():
    _reset_probe()
    with patch("core.llm_router._find_claude", return_value=None):
        with pytest.raises(RuntimeError, match="no_api_key"):
            await llm_router.call_llm("hello")


# ---------------------------------------------------------------------------
# stream_llm — same routing matrix, streaming variant
# ---------------------------------------------------------------------------

async def _drain(agen):
    return [c async for c in agen]


async def _yields(*items):
    for x in items:
        yield x


@pytest.mark.asyncio
async def test_stream_llm_routes_to_anthropic():
    with patch("core.anthropic_client.stream_anthropic", side_effect=lambda p, k: _yields("a", "b")):
        chunks = await _drain(llm_router.stream_llm("hi", api_key="sk-ant", provider="anthropic"))
    assert chunks == ["a", "b"]


@pytest.mark.asyncio
async def test_stream_llm_routes_to_openai():
    with patch("core.openai_client.stream_openai", side_effect=lambda p, k: _yields("o1", "o2")):
        chunks = await _drain(llm_router.stream_llm("hi", api_key="sk-x", provider="openai"))
    assert chunks == ["o1", "o2"]


@pytest.mark.asyncio
async def test_stream_llm_defaults_to_gemini_when_no_provider():
    with patch("core.gemini_client.stream_gemini", side_effect=lambda p, k: _yields("g1")):
        chunks = await _drain(llm_router.stream_llm("hi", api_key="AIza"))
    assert chunks == ["g1"]


@pytest.mark.asyncio
async def test_stream_llm_uses_claude_cli_when_no_key_and_local_mode():
    _reset_probe()
    with (
        patch("core.llm_router._find_claude", return_value="/bin/claude"),
        patch("core.claude_client.stream_claude", side_effect=lambda p: _yields("c1", "c2")),
    ):
        chunks = await _drain(llm_router.stream_llm("hi"))
    assert chunks == ["c1", "c2"]


@pytest.mark.asyncio
async def test_stream_llm_raises_no_api_key_in_deployed_mode():
    _reset_probe()
    with patch("core.llm_router._find_claude", return_value=None):
        with pytest.raises(RuntimeError, match="no_api_key"):
            async for _ in llm_router.stream_llm("hi"):
                pass
