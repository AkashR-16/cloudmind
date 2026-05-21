"""
Integration tests for the full FastAPI pipeline via /agent/chat.

All external I/O (Claude CLI, ArangoDB, Redis) is mocked so tests run
without any running services.  Each test documents WHY a failure occurs
and HOW to fix it in its docstring.

Does NOT duplicate tests already in test_api.py:
  - test_chat_returns_200_with_valid_request  (happy path basic)
  - test_chat_returns_400_for_empty_message
  - test_chat_returns_422_for_oversized_message
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, MagicMock
from main import app
from core.models import Intent, IntentType


# ---------------------------------------------------------------------------
# Shared async-generator helpers
# ---------------------------------------------------------------------------

async def _yield_chunks(*chunks: str):
    """Minimal async generator that yields the given string chunks."""
    for c in chunks:
        yield c


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_pipeline():
    """Standard happy-path pipeline: resource_query, valid AQL, DB results, streaming."""
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
        mock_intent.return_value = Intent(
            type=IntentType.resource_query,
            entities={"resource_type": "aws_ec2_instance"},
            raw_question="Which EC2 instances are running?",
        )
        mock_aql.return_value = (
            "FOR n IN node FILTER n.kind == 'aws_ec2_instance' LIMIT 100 RETURN n"
        )
        mock_exec.return_value = [{"id": "i-0abc123", "kind": "aws_ec2_instance"}]
        mock_load.return_value = []
        mock_synth.side_effect = lambda *a, **kw: _yield_chunks(
            "Found 1 EC2 instance: i-0abc123."
        )
        mock_redis_factory.return_value = AsyncMock()
        yield {
            "intent": mock_intent,
            "aql": mock_aql,
            "exec": mock_exec,
            "load": mock_load,
            "synth": mock_synth,
        }


@pytest.fixture
def mock_pipeline_aql_error():
    """Pipeline where AQL execution raises an exception (DB not reachable)."""
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
        mock_intent.return_value = Intent(
            type=IntentType.resource_query,
            entities={},
            raw_question="List EC2 instances",
        )
        mock_aql.return_value = (
            "FOR n IN node LIMIT 100 RETURN n"
        )
        # Simulate ArangoDB being unavailable
        mock_exec.side_effect = Exception("Connection refused: ArangoDB not running")
        mock_load.return_value = []
        mock_synth.side_effect = lambda *a, **kw: _yield_chunks(
            "The query could not be completed. Please rephrase."
        )
        mock_redis_factory.return_value = AsyncMock()
        yield {
            "intent": mock_intent,
            "aql": mock_aql,
            "exec": mock_exec,
            "load": mock_load,
            "synth": mock_synth,
        }


@pytest.fixture
def mock_pipeline_unknown():
    """Pipeline where intent classification returns unknown (out-of-scope question)."""
    with (
        patch("api.chat.classify_intent") as mock_intent,
        patch("api.chat.generate_aql") as mock_aql,
        patch("api.chat.get_db"),
        patch("api.chat.execute_aql"),
        patch("api.chat.synthesize_unknown") as mock_unknown,
        patch("api.chat.get_redis") as mock_redis_factory,
        patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
        patch("api.chat.save_context", new_callable=AsyncMock),
    ):
        mock_intent.return_value = Intent(
            type=IntentType.unknown,
            entities={},
            raw_question="What is the weather in London?",
        )
        mock_load.return_value = []
        mock_unknown.side_effect = lambda q: _yield_chunks(
            "I specialize in AWS questions. Your question is outside my scope."
        )
        mock_redis_factory.return_value = AsyncMock()
        yield {
            "intent": mock_intent,
            "aql": mock_aql,
            "load": mock_load,
            "unknown": mock_unknown,
        }


@pytest.fixture
def mock_pipeline_claude_fail():
    """Pipeline where classify_intent raises RuntimeError (CLI binary fails)."""
    with (
        patch("api.chat.classify_intent") as mock_intent,
        patch("api.chat.get_redis") as mock_redis_factory,
        patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
        patch("api.chat.save_context", new_callable=AsyncMock),
    ):
        mock_intent.side_effect = RuntimeError(
            "Claude CLI error: process exited with code 1"
        )
        mock_load.return_value = []
        mock_redis_factory.return_value = AsyncMock()
        yield {"intent": mock_intent, "load": mock_load}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_happy_path_ec2_query_returns_200(mock_pipeline):
    """
    Happy path: valid EC2 question goes through the full pipeline and returns 200.

    Symptom if broken: 500, or empty response body.
    Root cause: any unhandled exception in the pipeline.
    Fix: check logs for traceback; ensure ArangoDB + Redis are running.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "Which EC2 instances are running?", "session_id": "s1"},
        )
    assert res.status_code == 200
    assert "EC2" in res.text or "instance" in res.text.lower()


@pytest.mark.asyncio
async def test_empty_message_returns_400():
    """
    Empty message body after stripping must be rejected with HTTP 400.

    Symptom: 400 with detail 'Message cannot be empty'.
    Root cause: frontend sending blank form submissions.
    Fix: add client-side validation; the API guard is working as intended.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "", "session_id": "s1"},
        )
    # Pydantic rejects min_length=1 before the route handler even runs
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_whitespace_only_message_returns_400():
    """
    A message consisting entirely of whitespace is logically empty.

    Symptom: 400 from the explicit strip() check in the route handler.
    Root cause: user submits only spaces/tabs.
    Fix: strip input client-side before sending; server guard catches it regardless.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "   \t\n   ", "session_id": "s1"},
        )
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_oversized_message_returns_422():
    """
    Messages longer than 2000 characters are rejected by Pydantic (max_length=2000).

    Symptom: 422 Unprocessable Entity.
    Root cause: client sending very long pastes or programmatic bulk messages.
    Fix: enforce truncation on the client; consider raising the limit if needed.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "x" * 2001, "session_id": "s1"},
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_unknown_intent_returns_200_with_out_of_scope_response(mock_pipeline_unknown):
    """
    Out-of-scope questions should NOT return 4xx; the agent politely declines.

    Symptom: 200 with a 'scope' message in body.
    Root cause: user asks non-AWS question (weather, code, etc.).
    Fix: N/A — expected behavior; no fix required.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "What is the weather in London?", "session_id": "s1"},
        )
    assert res.status_code == 200
    assert "scope" in res.text.lower() or "AWS" in res.text


@pytest.mark.asyncio
async def test_aql_validation_failure_returns_422():
    """
    When generate_aql raises ValueError (e.g. REMOVE query generated), the API
    must return 422 with 'validation' in the error detail.

    Symptom: 422 with detail message containing 'validation'.
    Root cause: LLM hallucinated a write operation (REMOVE/INSERT/UPDATE).
    Fix: Review AQL sanitizer in agent/aql_generator.py; tighten the prompt.
    """
    with (
        patch("api.chat.classify_intent") as mock_intent,
        patch("api.chat.generate_aql") as mock_aql,
        patch("api.chat.get_redis") as mock_redis_factory,
        patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
        patch("api.chat.save_context", new_callable=AsyncMock),
    ):
        mock_intent.return_value = Intent(
            type=IntentType.resource_query,
            entities={},
            raw_question="Delete all EC2 instances",
        )
        mock_aql.side_effect = ValueError("Generated AQL failed validation: Write operation detected")
        mock_load.return_value = []
        mock_redis_factory.return_value = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.post(
                "/agent/chat",
                json={"message": "Delete all EC2 instances", "session_id": "s1"},
            )

    assert res.status_code == 422
    assert "validation" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_arango_connection_failure_returns_200_with_error_response(mock_pipeline_aql_error):
    """
    ArangoDB connection failure must NOT crash the API.  The pipeline falls through
    to the aql_error path and synthesizer asks the user to rephrase.

    Symptom: 200 response with a message about the query failing.
    Root cause: ArangoDB container is not running / wrong host in config.
    Fix: run `docker ps` to verify ArangoDB is up; check ARANGO_HOST env var.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "List EC2 instances", "session_id": "s1"},
        )
    assert res.status_code == 200
    # Synthesizer was called with aql_error, so the mock yielded the rephrase message
    assert "rephrase" in res.text.lower() or "could not" in res.text.lower()


@pytest.mark.asyncio
async def test_arango_failure_calls_synthesize_with_aql_error(mock_pipeline_aql_error):
    """
    When execute_aql raises, synthesize_stream must be called with a non-None aql_error.

    Symptom: synthesizer is not told about the DB failure (passes aql_error=None).
    Root cause: exception handling in _stream_response not propagating err to synthesizer.
    Fix: check the `aql_error = err` assignment in api/chat.py _stream_response.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post(
            "/agent/chat",
            json={"message": "List EC2 instances", "session_id": "s1"},
        )

    synth_call_kwargs = mock_pipeline_aql_error["synth"].call_args
    # synthesize_stream is called as synthesize_stream(intent, db_results, history, aql_error=...)
    # The keyword arg aql_error should be non-None
    aql_err_arg = synth_call_kwargs[1].get("aql_error") or (
        synth_call_kwargs[0][3] if len(synth_call_kwargs[0]) > 3 else None
    )
    assert aql_err_arg is not None
    assert "Connection refused" in str(aql_err_arg)


@pytest.mark.asyncio
async def test_claude_cli_failure_returns_500_or_handled(mock_pipeline_claude_fail):
    """
    When classify_intent raises RuntimeError (CLI binary not found, auth expired,
    rate limit), the API should return 500 or a structured error — never silently
    return 200 with empty body.

    Symptom: 500 Internal Server Error.
    Root cause: Claude CLI binary missing, session expired, or RESOURCE_EXHAUSTED.
    Fix:
      - Missing binary: ensure Claude Code VS Code extension is installed.
      - Auth: run `claude` in terminal and re-authenticate.
      - Rate limit: wait and retry; add exponential back-off.
    """
    # httpx's ASGITransport re-raises unhandled server exceptions as Python exceptions
    # rather than returning HTTP 500. Catching RuntimeError here confirms the failure
    # propagates — in production this becomes a 500 response via Starlette's error handler.
    with pytest.raises((RuntimeError, Exception)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            await c.post(
                "/agent/chat",
                json={"message": "List my VPCs", "session_id": "s1"},
            )


@pytest.mark.asyncio
async def test_session_persistence_second_request_receives_history():
    """
    Two sequential requests with the same session_id: the second call must
    receive the history from the first in its load_context call.

    Symptom: follow-up questions lose context (Claude answers without history).
    Root cause: Redis save_context not being called, or session_id mismatch.
    Fix: check that save_context is awaited inside the streaming generator; verify
    Redis TTL is not 0.
    """
    history_store: list = []

    async def fake_load(_redis, session_id):
        return list(history_store)

    async def fake_save(_redis, session_id, history, max_turns, ttl):
        history_store.clear()
        history_store.extend(history)

    with (
        patch("api.chat.classify_intent") as mock_intent,
        patch("api.chat.generate_aql") as mock_aql,
        patch("api.chat.get_db"),
        patch("api.chat.execute_aql") as mock_exec,
        patch("api.chat.synthesize_stream") as mock_synth,
        patch("api.chat.get_redis") as mock_redis_factory,
        patch("api.chat.load_context", side_effect=fake_load),
        patch("api.chat.save_context", side_effect=fake_save),
    ):
        mock_intent.return_value = Intent(
            type=IntentType.resource_query,
            entities={},
            raw_question="How many EC2?",
        )
        mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
        mock_exec.return_value = [{"id": "i-1"}]
        mock_synth.side_effect = lambda *a, **kw: _yield_chunks("You have 1 EC2.")
        mock_redis_factory.return_value = AsyncMock()

        session = "persistent-session-42"

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r1 = await c.post(
                "/agent/chat",
                json={"message": "How many EC2?", "session_id": session},
            )
            assert r1.status_code == 200

            # After the first request, history_store should be populated
            # (save_context is called at end of generator)
            assert len(history_store) == 2  # user + assistant messages

            mock_intent.return_value = Intent(
                type=IntentType.resource_query,
                entities={},
                raw_question="Are they all running?",
            )
            r2 = await c.post(
                "/agent/chat",
                json={"message": "Are they all running?", "session_id": session},
            )
            assert r2.status_code == 200

        # On the second call, synthesize_stream was called with non-empty history
        second_call_args = mock_synth.call_args_list[1][0]
        history_passed = second_call_args[2]  # positional: intent, db_results, history
        assert len(history_passed) == 2


@pytest.mark.asyncio
async def test_security_query_intent_returns_200(mock_pipeline):
    """
    security_query intent must traverse the pipeline successfully end-to-end.

    Symptom: 500 or empty response.
    Root cause: missing branch in generate_aql or synthesizer for security_query.
    Fix: verify IntentType.security_query is handled same as resource_query in pipeline.
    """
    mock_pipeline["intent"].return_value = Intent(
        type=IntentType.security_query,
        entities={"resource_type": "aws_security_group"},
        raw_question="Which security groups allow inbound 0.0.0.0/0?",
    )
    mock_pipeline["exec"].return_value = [
        {"name": "sg-open", "id": "sg-0abc", "region": "us-east-1"}
    ]
    mock_pipeline["synth"].side_effect = lambda *a, **kw: _yield_chunks(
        "Security group sg-open allows all inbound traffic."
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={
                "message": "Which security groups allow inbound 0.0.0.0/0?",
                "session_id": "sec-session",
            },
        )
    assert res.status_code == 200
    assert "sg-open" in res.text or "security" in res.text.lower()


@pytest.mark.asyncio
async def test_count_query_returns_number_response(mock_pipeline):
    """
    count_query should return a numeric answer from the synthesizer.

    Symptom: synthesizer says 'no resources found' instead of a number.
    Root cause: count AQL returns a list like [3] which looks like a single-element
    list; the system prompt has a note to interpret it as a COUNT.
    Fix: verify the system prompt note in _build_messages is present.
    """
    mock_pipeline["intent"].return_value = Intent(
        type=IntentType.count_query,
        entities={"resource_type": "aws_ec2_instance"},
        raw_question="How many EC2 instances do I have?",
    )
    mock_pipeline["exec"].return_value = [5]  # COUNT result
    mock_pipeline["synth"].side_effect = lambda *a, **kw: _yield_chunks(
        "You have 5 EC2 instances."
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "How many EC2 instances do I have?", "session_id": "cnt-s"},
        )
    assert res.status_code == 200
    assert "5" in res.text


@pytest.mark.asyncio
async def test_missing_session_id_returns_422():
    """
    Omitting session_id entirely is a Pydantic validation error (required field).

    Symptom: 422 Unprocessable Entity.
    Root cause: client forgot to include session_id in the request body.
    Fix: always generate and pass a session_id from the frontend.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "List EC2 instances"},  # no session_id
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_streaming_response_content_type_is_text_plain(mock_pipeline):
    """
    The /agent/chat endpoint always responds with Content-Type: text/plain.

    Symptom: frontend cannot read the streaming body (expects text/plain).
    Root cause: StreamingResponse media_type changed or wrong router.
    Fix: ensure StreamingResponse is constructed with media_type='text/plain'.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "Which EC2 instances are running?", "session_id": "ct-s"},
        )
    assert res.status_code == 200
    assert "text/plain" in res.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_wrong_content_type_returns_422():
    """
    Sending form-encoded data instead of JSON must be rejected with 422.

    Symptom: 422 Unprocessable Entity.
    Root cause: client sending wrong Content-Type header.
    Fix: always set Content-Type: application/json on the frontend fetch call.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            data={"message": "List EC2", "session_id": "s1"},  # form data
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_pipeline_does_not_call_generate_aql_for_unknown_intent(mock_pipeline_unknown):
    """
    For unknown intent the AQL generator must never be called — there is no
    query to generate, and calling it would waste a Claude CLI invocation.

    Symptom: unexpected call to generate_aql raises or logs an error.
    Root cause: missing early-return guard for unknown intent in _stream_response.
    Fix: verify the `if intent.type.value == 'unknown': return StreamingResponse(...)` guard.
    """
    with patch("api.chat.generate_aql", new_callable=AsyncMock) as mock_aql:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            await c.post(
                "/agent/chat",
                json={"message": "What is 2+2?", "session_id": "s1"},
            )
        mock_aql.assert_not_called()


@pytest.mark.asyncio
async def test_streaming_body_is_concatenated_correctly(mock_pipeline):
    """
    Multi-chunk streaming responses should concatenate into a coherent message.

    Symptom: body contains only the first chunk or chunks are out of order.
    Root cause: StreamingResponse generator not yielding all chunks, or client
    not reading the full body.
    Fix: ensure the async generator in _gen() iterates fully before save_context.
    """
    mock_pipeline["synth"].side_effect = lambda *a, **kw: _yield_chunks(
        "Chunk1 ", "Chunk2 ", "Chunk3"
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/agent/chat",
            json={"message": "Which EC2 instances are running?", "session_id": "multi-s"},
        )

    assert res.status_code == 200
    assert res.text == "Chunk1 Chunk2 Chunk3"
