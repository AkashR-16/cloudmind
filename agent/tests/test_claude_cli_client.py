"""
Tests for core/claude_client.py.

Mocks asyncio.create_subprocess_exec so the real `claude` CLI binary is never
invoked.  Every test is self-contained; no shared state between tests.
"""

import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock


# ---------------------------------------------------------------------------
# Helpers — fake subprocess + realistic NDJSON line factories
# ---------------------------------------------------------------------------

async def _aiter_lines(lines: list[bytes]):
    """Async generator that yields bytes lines, simulating proc.stdout.__aiter__."""
    for line in lines:
        yield line


def make_mock_process(stdout_lines: list[str], returncode: int = 0) -> MagicMock:
    """Return a MagicMock that behaves like an asyncio subprocess."""
    mock_proc = MagicMock()
    mock_proc.returncode = returncode

    # call_claude path — uses proc.communicate()
    encoded = ("\n".join(stdout_lines) + "\n").encode()
    mock_proc.communicate = AsyncMock(return_value=(encoded, b""))

    # stream_claude path — iterates proc.stdout line-by-line
    encoded_lines = [line.encode() + b"\n" for line in stdout_lines]
    mock_proc.stdout = MagicMock()
    mock_proc.stdout.__aiter__ = lambda self: _aiter_lines(encoded_lines)
    mock_proc.wait = AsyncMock(return_value=None)

    return mock_proc


def make_delta(text: str) -> str:
    """Produce a stream_event / content_block_delta NDJSON line."""
    return json.dumps({
        "type": "stream_event",
        "event": {
            "type": "content_block_delta",
            "index": 0,
            "delta": {"type": "text_delta", "text": text},
        },
    })


def make_system_init() -> str:
    return json.dumps({"type": "system", "subtype": "init", "session_id": "abc123"})


def make_result(text: str) -> str:
    return json.dumps({"type": "result", "subtype": "success", "result": text})


def make_message_start() -> str:
    return json.dumps({"type": "message_start", "message": {"id": "msg_abc"}})


def make_rate_limit_event() -> str:
    return json.dumps({"type": "rate_limit_warning", "tokens": 50000})


# ---------------------------------------------------------------------------
# call_claude — happy path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_claude_returns_stripped_stdout():
    """call_claude should return the decoded, stripped stdout text."""
    mock_proc = make_mock_process(["  Hello, CloudMind!  "])
    # communicate returns the raw encoded text; the function strips it
    mock_proc.communicate = AsyncMock(return_value=(b"  Hello, CloudMind!  \n", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import call_claude
        result = await call_claude("List EC2 instances")

    assert result == "Hello, CloudMind!"


@pytest.mark.asyncio
async def test_call_claude_returns_multiline_stdout_stripped():
    """Multiline stdout should have leading/trailing whitespace stripped."""
    mock_proc = make_mock_process([])
    mock_proc.communicate = AsyncMock(return_value=(b"\n\nsome answer\n\n", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import call_claude
        result = await call_claude("test prompt")

    assert result == "some answer"


# ---------------------------------------------------------------------------
# call_claude — failure path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_claude_raises_runtime_error_on_nonzero_exit():
    """Non-zero returncode must raise RuntimeError with the stderr message."""
    mock_proc = make_mock_process([], returncode=1)
    mock_proc.communicate = AsyncMock(return_value=(b"", b"auth token expired"))

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import call_claude
        with pytest.raises(RuntimeError, match="Claude CLI error"):
            await call_claude("some prompt")


@pytest.mark.asyncio
async def test_call_claude_error_message_contains_stderr():
    """The RuntimeError message should include the text from stderr."""
    mock_proc = make_mock_process([], returncode=2)
    mock_proc.communicate = AsyncMock(
        return_value=(b"", b"RESOURCE_EXHAUSTED: quota exceeded")
    )

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import call_claude
        with pytest.raises(RuntimeError) as exc_info:
            await call_claude("test")

    assert "RESOURCE_EXHAUSTED" in str(exc_info.value)


# ---------------------------------------------------------------------------
# call_claude — CLI flags
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_claude_passes_output_format_text_flag():
    """The subprocess must be launched with --output-format text."""
    mock_proc = make_mock_process([])
    mock_proc.communicate = AsyncMock(return_value=(b"ok", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        from core.claude_client import call_claude
        await call_claude("test prompt")

    call_args = mock_exec.call_args[0]
    assert "--output-format" in call_args
    text_idx = list(call_args).index("--output-format")
    assert call_args[text_idx + 1] == "text"


@pytest.mark.asyncio
async def test_call_claude_passes_no_session_persistence_flag():
    """The subprocess must be launched with --no-session-persistence."""
    mock_proc = make_mock_process([])
    mock_proc.communicate = AsyncMock(return_value=(b"ok", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        from core.claude_client import call_claude
        await call_claude("test prompt")

    call_args = mock_exec.call_args[0]
    assert "--no-session-persistence" in call_args


@pytest.mark.asyncio
async def test_call_claude_passes_prompt_via_p_flag():
    """The prompt string must be passed via the -p flag."""
    mock_proc = make_mock_process([])
    mock_proc.communicate = AsyncMock(return_value=(b"answer", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        from core.claude_client import call_claude
        await call_claude("my specific prompt")

    call_args = list(mock_exec.call_args[0])
    assert "-p" in call_args
    p_idx = call_args.index("-p")
    assert call_args[p_idx + 1] == "my specific prompt"


# ---------------------------------------------------------------------------
# stream_claude — happy path: content_block_delta events
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_claude_yields_text_from_content_block_delta():
    """stream_claude should yield the text field from content_block_delta events."""
    lines = [make_delta("Hello, ")]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["Hello, "]


@pytest.mark.asyncio
async def test_stream_claude_yields_multiple_chunks_in_order():
    """Multiple delta events should be yielded in the exact order they appear."""
    lines = [
        make_delta("chunk1"),
        make_delta(" chunk2"),
        make_delta(" chunk3"),
    ]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["chunk1", " chunk2", " chunk3"]


# ---------------------------------------------------------------------------
# stream_claude — skipping non-content-delta lines
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_claude_skips_system_init_lines():
    """system/init events must be silently skipped."""
    lines = [make_system_init(), make_delta("real text")]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["real text"]


@pytest.mark.asyncio
async def test_stream_claude_skips_result_events():
    """result events must be silently skipped."""
    lines = [make_delta("answer"), make_result("answer")]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["answer"]


@pytest.mark.asyncio
async def test_stream_claude_skips_message_start_events():
    """message_start events must be silently skipped."""
    lines = [make_message_start(), make_delta("data")]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["data"]


@pytest.mark.asyncio
async def test_stream_claude_skips_rate_limit_events():
    """rate_limit_warning events must be silently skipped."""
    lines = [make_rate_limit_event(), make_delta("text after warning")]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["text after warning"]


@pytest.mark.asyncio
async def test_stream_claude_skips_empty_lines():
    """Blank lines in the NDJSON stream must not cause errors or produce output."""
    encoded_lines = [b"\n", b"   \n", make_delta("ok").encode() + b"\n"]
    mock_proc = make_mock_process([])
    mock_proc.stdout.__aiter__ = lambda self: _aiter_lines(encoded_lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["ok"]


# ---------------------------------------------------------------------------
# stream_claude — malformed JSON resilience
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_claude_handles_malformed_json_without_crashing():
    """A line with invalid JSON must be skipped silently — no exception raised."""
    encoded_lines = [
        b"not json at all\n",
        b"{broken: json\n",
        make_delta("valid chunk").encode() + b"\n",
    ]
    mock_proc = make_mock_process([])
    mock_proc.stdout.__aiter__ = lambda self: _aiter_lines(encoded_lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    # Only the valid delta line should produce output
    assert chunks == ["valid chunk"]


@pytest.mark.asyncio
async def test_stream_claude_handles_partial_json_line():
    """Truncated JSON (e.g. network cut) must be silently skipped."""
    encoded_lines = [
        b'{"type": "stream_event", "event":\n',  # truncated
        make_delta("recovered").encode() + b"\n",
    ]
    mock_proc = make_mock_process([])
    mock_proc.stdout.__aiter__ = lambda self: _aiter_lines(encoded_lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["recovered"]


# ---------------------------------------------------------------------------
# stream_claude — empty text delta
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_claude_skips_empty_text_deltas():
    """content_block_delta events with empty text string must not produce output."""
    empty_delta = json.dumps({
        "type": "stream_event",
        "event": {
            "type": "content_block_delta",
            "index": 0,
            "delta": {"type": "text_delta", "text": ""},
        },
    })
    lines = [empty_delta, make_delta("non-empty")]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == ["non-empty"]


@pytest.mark.asyncio
async def test_stream_claude_returns_no_chunks_for_all_non_delta_stream():
    """A stream containing only non-delta events should yield nothing."""
    lines = [make_system_init(), make_result("summary"), make_message_start()]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("test")]

    assert chunks == []


# ---------------------------------------------------------------------------
# stream_claude — calls proc.wait() after iterating
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_claude_calls_proc_wait_after_iteration():
    """proc.wait() must be awaited to properly reap the subprocess."""
    lines = [make_delta("done")]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        _ = [chunk async for chunk in stream_claude("test")]

    mock_proc.wait.assert_awaited_once()


# ---------------------------------------------------------------------------
# stream_claude — mixed realistic NDJSON stream
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stream_claude_realistic_mixed_ndjson():
    """
    A realistic NDJSON stream interleaving system events, multiple deltas,
    and a result event.  Only the text_delta lines should be yielded.
    """
    lines = [
        make_system_init(),
        make_message_start(),
        make_delta("You have "),
        make_delta("3 EC2 instances "),
        make_delta("running in us-east-1."),
        make_result("You have 3 EC2 instances running in us-east-1."),
    ]
    mock_proc = make_mock_process(lines)

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        from core.claude_client import stream_claude
        chunks = [chunk async for chunk in stream_claude("List EC2")]

    assert chunks == ["You have ", "3 EC2 instances ", "running in us-east-1."]
    assert "".join(chunks) == "You have 3 EC2 instances running in us-east-1."
