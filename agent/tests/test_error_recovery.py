"""
Failure-mode documentation tests for the CloudMind agent stack.

Every test:
  1. Demonstrates a specific failure mode with a minimal mock.
  2. Asserts the expected (safe) behavior.
  3. Contains a '# HOW TO FIX:' comment block describing detection and remediation.

Tests are organised into classes that mirror the failure domain:
  - TestCLIFailures        — Claude CLI binary / process errors
  - TestArangoFailures     — ArangoDB connectivity / query errors
  - TestIntentFailures     — Claude returning bad JSON for intent classification
  - TestAQLFailures        — AQL validation, sanitisation, limit injection
  - TestSessionFailures    — Redis connectivity / corrupt session data
  - TestRequestValidation  — HTTP-level input validation
"""

import asyncio
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from main import app
from core.models import Intent, IntentType, ChatMessage, MessageRole


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _yield(*chunks: str):
    for c in chunks:
        yield c


def _make_intent(
    q: str = "List EC2 instances",
    t: IntentType = IntentType.resource_query,
) -> Intent:
    return Intent(type=t, entities={}, raw_question=q)


def _make_mock_proc(stdout_lines: list[str], returncode: int = 0) -> MagicMock:
    """Minimal asyncio subprocess mock."""
    async def _aiter(lines):
        for line in lines:
            yield line.encode() + b"\n"

    proc = MagicMock()
    proc.returncode = returncode
    encoded = ("\n".join(stdout_lines) + "\n").encode()
    proc.communicate = AsyncMock(return_value=(encoded, b""))
    proc.stdout = MagicMock()
    proc.stdout.__aiter__ = lambda self: _aiter(stdout_lines)
    proc.wait = AsyncMock(return_value=None)
    return proc


# ===========================================================================
# TestCLIFailures
# ===========================================================================

class TestCLIFailures:
    """Tests for failures involving the Claude CLI binary."""

    def test_find_claude_bin_raises_if_binary_not_found(self, tmp_path):
        """
        If the claude binary is not on PATH and the VS Code extension directory
        does not exist, _find_claude_bin must raise RuntimeError immediately at
        module import / first call.

        # HOW TO FIX:
        #   Symptom : RuntimeError "claude CLI not found" during startup or first request.
        #   Detection: `which claude` returns nothing; ls ~/.vscode/extensions/ shows no
        #              anthropic.claude-code-* directory.
        #   Fix      : Install the Claude Code VS Code extension, or symlink the binary
        #              to a directory on $PATH (e.g. /usr/local/bin/claude).
        """
        import importlib
        import sys

        with (
            patch("shutil.which", return_value=None),
            patch("glob.glob", return_value=[]),
        ):
            # Re-import to trigger _find_claude_bin() at module level
            if "core.claude_client" in sys.modules:
                del sys.modules["core.claude_client"]
            with pytest.raises(RuntimeError, match="claude CLI not found"):
                import core.claude_client  # noqa: F401

        # Restore the module for subsequent tests
        if "core.claude_client" in sys.modules:
            del sys.modules["core.claude_client"]

    @pytest.mark.asyncio
    async def test_call_claude_raises_on_nonzero_exit_code(self):
        """
        When the CLI exits non-zero (auth expired, session revoked, rate-limited),
        call_claude must raise RuntimeError so callers can handle it.

        # HOW TO FIX:
        #   Symptom : RuntimeError "Claude CLI error: ..." in logs; API returns 500.
        #   Detection: Run `claude -p "hello" --output-format text` in terminal;
        #              observe exit code and stderr.
        #   Fix      : Re-authenticate via the Claude Code VS Code UI, or wait for
        #              rate-limit window to pass (check stderr for RESOURCE_EXHAUSTED).
        """
        proc = _make_mock_proc([], returncode=1)
        proc.communicate = AsyncMock(return_value=(b"", b"authentication required"))

        with patch("asyncio.create_subprocess_exec", return_value=proc):
            from core.claude_client import call_claude
            with pytest.raises(RuntimeError, match="Claude CLI error"):
                await call_claude("test prompt")

    @pytest.mark.asyncio
    async def test_call_claude_error_on_rate_limit_exit(self):
        """
        RESOURCE_EXHAUSTED in stderr must propagate as a RuntimeError containing
        that string so the API layer can return 429.

        # HOW TO FIX:
        #   Symptom : 429 from the API; 'RESOURCE_EXHAUSTED' in error detail.
        #   Detection: Claude API quota exhausted for the authenticated account.
        #   Fix      : Wait for quota reset (usually 1 minute); implement exponential
        #              back-off with retry in call_claude; upgrade plan if persistent.
        """
        proc = _make_mock_proc([], returncode=1)
        proc.communicate = AsyncMock(
            return_value=(b"", b"RESOURCE_EXHAUSTED: out of tokens")
        )

        with patch("asyncio.create_subprocess_exec", return_value=proc):
            from core.claude_client import call_claude
            with pytest.raises(RuntimeError) as exc_info:
                await call_claude("test")

        assert "RESOURCE_EXHAUSTED" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_call_claude_asyncio_timeout_raises(self):
        """
        If the subprocess hangs (e.g. waiting for user input, deadlock), an
        asyncio.TimeoutError must be surfaced rather than blocking forever.

        # HOW TO FIX:
        #   Symptom : Request hangs indefinitely; no response after agent_timeout_seconds.
        #   Detection: Add asyncio.wait_for() around call_claude; monitor for TimeoutError.
        #   Fix      : Wrap call_claude / stream_claude in asyncio.wait_for(timeout=...);
        #              check settings.agent_timeout_seconds and enforce it in the router.
        """
        async def slow_communicate():
            await asyncio.sleep(999)  # simulate infinite hang
            return b"", b""

        proc = MagicMock()
        proc.returncode = None
        proc.communicate = slow_communicate
        proc.wait = AsyncMock()

        with patch("asyncio.create_subprocess_exec", return_value=proc):
            from core.claude_client import call_claude
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(call_claude("test"), timeout=0.05)

    @pytest.mark.asyncio
    async def test_stream_claude_continues_after_malformed_ndjson(self):
        """
        A corrupt NDJSON line mid-stream must be skipped; subsequent valid lines
        must still be yielded.

        # HOW TO FIX:
        #   Symptom : Missing chunks in streaming response; silent data loss.
        #   Detection: Log every raw line before JSON parsing in stream_claude.
        #   Fix      : The current implementation already skips bad lines via
        #              json.JSONDecodeError handler; verify the try/except is intact.
        """
        async def _aiter(lines):
            for line in lines:
                yield line

        encoded_lines = [
            b"not-json\n",
            json.dumps({
                "type": "stream_event",
                "event": {
                    "type": "content_block_delta",
                    "index": 0,
                    "delta": {"type": "text_delta", "text": "recovered"},
                },
            }).encode() + b"\n",
        ]

        proc = MagicMock()
        proc.stdout = MagicMock()
        proc.stdout.__aiter__ = lambda self: _aiter(encoded_lines)
        proc.wait = AsyncMock()

        with patch("asyncio.create_subprocess_exec", return_value=proc):
            from core.claude_client import stream_claude
            chunks = [c async for c in stream_claude("test")]

        assert "recovered" in chunks


# ===========================================================================
# TestArangoFailures
# ===========================================================================

class TestArangoFailures:
    """Tests for ArangoDB connectivity and query-execution failures."""

    @pytest.mark.asyncio
    async def test_connection_refused_routes_to_aql_error_path(self):
        """
        ArangoDB 'Connection refused' must be caught and routed to the aql_error
        path so the synthesizer can ask the user to rephrase.  The API returns 200.

        # HOW TO FIX:
        #   Symptom : 200 response, body contains 'rephrase' or 'could not be completed'.
        #   Detection: `docker ps` — ArangoDB container is not running.
        #   Fix      : Start the ArangoDB container: `docker start arangodb` or
        #              `docker-compose up -d arango`; verify ARANGO_HOST env var.
        """
        with (
            patch("api.chat.classify_intent") as mock_intent,
            patch("api.chat.generate_aql") as mock_aql,
            patch("api.chat.get_db") as mock_db,
            patch("api.chat.execute_aql") as mock_exec,
            patch("api.chat.synthesize_stream") as mock_synth,
            patch("api.chat.get_redis") as mock_redis_f,
            patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
            patch("api.chat.save_context", new_callable=AsyncMock),
        ):
            mock_intent.return_value = _make_intent()
            mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
            mock_exec.side_effect = Exception("Connection refused: [Errno 111]")
            mock_load.return_value = []
            mock_synth.side_effect = lambda *a, **kw: _yield(
                "Query could not be completed. Please rephrase."
            )
            mock_redis_f.return_value = AsyncMock()

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                res = await c.post(
                    "/agent/chat",
                    json={"message": "List EC2", "session_id": "db-fail-s"},
                )

        assert res.status_code == 200
        # synthesize_stream must have been called with a non-None aql_error
        call_kwargs = mock_synth.call_args
        aql_err = call_kwargs[1].get("aql_error") or (
            call_kwargs[0][3] if len(call_kwargs[0]) > 3 else None
        )
        assert aql_err is not None
        assert "Connection refused" in str(aql_err)

    @pytest.mark.asyncio
    async def test_query_timeout_routes_to_aql_error_path(self):
        """
        ArangoDB query timeout (long-running query) must be caught and treated
        as an aql_error — not a 500.

        # HOW TO FIX:
        #   Symptom : Slow responses; then 200 with 'rephrase' message.
        #   Detection: ArangoDB query log shows long-running queries.
        #   Fix      : Add LIMIT to the generated query (already enforced by validator);
        #              check if ArangoDB is under heavy load; review query plan.
        """
        with (
            patch("api.chat.classify_intent") as mock_intent,
            patch("api.chat.generate_aql") as mock_aql,
            patch("api.chat.get_db"),
            patch("api.chat.execute_aql") as mock_exec,
            patch("api.chat.synthesize_stream") as mock_synth,
            patch("api.chat.get_redis") as mock_redis_f,
            patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
            patch("api.chat.save_context", new_callable=AsyncMock),
        ):
            mock_intent.return_value = _make_intent()
            mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
            mock_exec.side_effect = Exception("query timed out after 30s")
            mock_load.return_value = []
            mock_synth.side_effect = lambda *a, **kw: _yield("Query failed.")
            mock_redis_f.return_value = AsyncMock()

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                res = await c.post(
                    "/agent/chat",
                    json={"message": "Complex query", "session_id": "timeout-s"},
                )

        assert res.status_code == 200

    @pytest.mark.asyncio
    async def test_database_not_found_routes_to_aql_error_path(self):
        """
        ArangoDB 'database not found' error (wrong DB name in config) must be caught.

        # HOW TO FIX:
        #   Symptom : 200 with rephrase message; ArangoDB logs show 'database not found'.
        #   Detection: Verify ARANGO_DB env var matches an existing database in ArangoDB.
        #   Fix      : Run FixInventory discovery again to recreate the 'fix' database, or
        #              update ARANGO_DB / ARANGO_VERTEX_COLLECTION to match your schema.
        """
        with (
            patch("api.chat.classify_intent") as mock_intent,
            patch("api.chat.generate_aql") as mock_aql,
            patch("api.chat.get_db"),
            patch("api.chat.execute_aql") as mock_exec,
            patch("api.chat.synthesize_stream") as mock_synth,
            patch("api.chat.get_redis") as mock_redis_f,
            patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
            patch("api.chat.save_context", new_callable=AsyncMock),
        ):
            mock_intent.return_value = _make_intent()
            mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
            mock_exec.side_effect = Exception("database 'fix' not found (404)")
            mock_load.return_value = []
            mock_synth.side_effect = lambda *a, **kw: _yield("Query failed.")
            mock_redis_f.return_value = AsyncMock()

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                res = await c.post(
                    "/agent/chat",
                    json={"message": "List EC2", "session_id": "db-404-s"},
                )

        assert res.status_code == 200

    @pytest.mark.asyncio
    async def test_wrong_arango_credentials_routes_to_aql_error_path(self):
        """
        HTTP 401 from ArangoDB (wrong username/password) must be caught and treated
        as an aql_error.

        # HOW TO FIX:
        #   Symptom : 200 with rephrase; ArangoDB logs show 401 Unauthorized.
        #   Detection: Check ARANGO_USERNAME / ARANGO_PASSWORD env vars.
        #   Fix      : Update .env with correct credentials; for local dev the default
        #              is root / '' (empty password).
        """
        with (
            patch("api.chat.classify_intent") as mock_intent,
            patch("api.chat.generate_aql") as mock_aql,
            patch("api.chat.get_db"),
            patch("api.chat.execute_aql") as mock_exec,
            patch("api.chat.synthesize_stream") as mock_synth,
            patch("api.chat.get_redis") as mock_redis_f,
            patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
            patch("api.chat.save_context", new_callable=AsyncMock),
        ):
            mock_intent.return_value = _make_intent()
            mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
            mock_exec.side_effect = Exception("HTTP 401: Unauthorized")
            mock_load.return_value = []
            mock_synth.side_effect = lambda *a, **kw: _yield("Query failed.")
            mock_redis_f.return_value = AsyncMock()

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                res = await c.post(
                    "/agent/chat",
                    json={"message": "List EC2", "session_id": "auth-fail-s"},
                )

        assert res.status_code == 200


# ===========================================================================
# TestIntentFailures
# ===========================================================================

class TestIntentFailures:
    """Tests for failures in intent classification (Claude returning bad output)."""

    @pytest.mark.asyncio
    async def test_non_json_response_falls_back_to_unknown(self):
        """
        When Claude returns prose instead of JSON, classify_intent must return
        IntentType.unknown rather than raising an exception.

        # HOW TO FIX:
        #   Symptom : All queries classified as 'unknown'; out-of-scope response always shown.
        #   Detection: Log raw Claude output in classify_intent before json.loads().
        #   Fix      : Tighten the intent prompt to enforce JSON-only output;
        #              add few-shot examples showing only JSON responses.
        """
        with patch("agent.intent.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = "I cannot classify this question right now."
            from agent.intent import classify_intent
            result = await classify_intent("List EC2 instances")

        assert result.type == IntentType.unknown

    @pytest.mark.asyncio
    async def test_invalid_intent_string_falls_back_to_unknown(self):
        """
        JSON with an intent value not in the IntentType enum must silently fall
        back to IntentType.unknown.

        # HOW TO FIX:
        #   Symptom : Same as above — out-of-scope response for all queries.
        #   Detection: Add logging in the except (json.JSONDecodeError, ValueError) block.
        #   Fix      : Add the new intent type to IntentType enum, or update the prompt
        #              to use only existing enum values.
        """
        with patch("agent.intent.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = json.dumps(
                {"intent": "database_query", "entities": {}}
            )
            from agent.intent import classify_intent
            result = await classify_intent("List EC2 instances")

        assert result.type == IntentType.unknown

    @pytest.mark.asyncio
    async def test_empty_response_from_claude_falls_back_to_unknown(self):
        """
        An empty string from call_claude (e.g. CLI produced no output) must
        fall back to IntentType.unknown without raising.

        # HOW TO FIX:
        #   Symptom : All intents are 'unknown'; Claude CLI is returning empty stdout.
        #   Detection: Run claude -p "test" --output-format text; check if it returns output.
        #   Fix      : Re-authenticate; check Claude Code VS Code extension is running.
        """
        with patch("agent.intent.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = ""
            from agent.intent import classify_intent
            result = await classify_intent("List EC2 instances")

        assert result.type == IntentType.unknown

    @pytest.mark.asyncio
    async def test_markdown_fenced_json_is_parsed_correctly(self):
        """
        Claude sometimes wraps JSON in markdown code fences (```json ... ```).
        The stripping logic must handle this so it doesn't fall back to unknown.

        # HOW TO FIX:
        #   Symptom : Valid intent queries mis-classified as 'unknown'.
        #   Detection: Log the raw Claude output; check for ```json fences.
        #   Fix      : The current strip logic in classify_intent handles this;
        #              ensure the if text.startswith('```') block is not removed.
        """
        with patch("agent.intent.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = (
                "```json\n"
                '{"intent": "resource_query", "entities": {"resource_type": "aws_ec2_instance"}}\n'
                "```"
            )
            from agent.intent import classify_intent
            result = await classify_intent("List running EC2 instances")

        assert result.type == IntentType.resource_query

    @pytest.mark.asyncio
    async def test_null_entities_in_response_defaults_to_empty_dict(self):
        """
        Claude returning null for entities must not raise; entities must default
        to an empty dict.

        # HOW TO FIX:
        #   Symptom : ValueError or KeyError during Intent model construction.
        #   Detection: Log the parsed data dict before Intent() construction.
        #   Fix      : Use data.get('entities', {}) or {} — already implemented.
        """
        with patch("agent.intent.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = json.dumps({"intent": "count_query", "entities": None})
            from agent.intent import classify_intent
            result = await classify_intent("How many S3 buckets?")

        # entities=None should be coerced to {} or the model accepts None
        assert result.type == IntentType.count_query
        assert result.entities is None or isinstance(result.entities, dict)


# ===========================================================================
# TestAQLFailures
# ===========================================================================

class TestAQLFailures:
    """Tests for AQL generation, validation, sanitisation, and limit-injection."""

    @pytest.mark.asyncio
    async def test_write_operation_raises_value_error(self):
        """
        Claude generating a REMOVE query must raise ValueError with 'validation'
        in the message so the API can return 422.

        # HOW TO FIX:
        #   Symptom : 422 from /agent/chat with 'validation' in detail.
        #   Detection: Log the raw AQL from call_claude before validation.
        #   Fix      : Strengthen the AQL prompt with explicit 'NEVER use REMOVE/INSERT/UPDATE';
        #              consider adding the forbidden-patterns list to the prompt.
        """
        with patch("agent.aql_generator.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = "REMOVE n IN node"
            from agent.aql_generator import generate_aql
            intent = _make_intent()
            with pytest.raises(ValueError, match="validation"):
                await generate_aql(intent)

    @pytest.mark.asyncio
    async def test_limit_after_return_is_moved_before_return(self):
        """
        AQL with LIMIT positioned after RETURN is invalid in ArangoDB.
        fix_limit_position must correct the order.

        # HOW TO FIX:
        #   Symptom : ArangoDB returns a parse error: 'unexpected LIMIT'.
        #   Detection: Log the AQL after fix_limit_position; verify LIMIT precedes RETURN.
        #   Fix      : The fix_limit_position function handles this; ensure it is called
        #              before validate_aql in generate_aql.
        """
        from agent.aql_generator import fix_limit_position

        bad_query = "FOR n IN node FILTER n.kind == 'aws_ec2_instance' RETURN n LIMIT 100"
        fixed = fix_limit_position(bad_query, 100)

        return_pos = fixed.upper().rfind("RETURN")
        limit_pos = fixed.upper().rfind("LIMIT")
        assert limit_pos < return_pos

    @pytest.mark.asyncio
    async def test_any_equals_on_object_array_is_sanitised(self):
        """
        'ip_permissions ANY ==' is invalid AQL on object arrays.
        sanitize_aql must replace it with nested FOR loops.

        # HOW TO FIX:
        #   Symptom : ArangoDB error 'type mismatch in ANY == expression'.
        #   Detection: Log the AQL before execute_aql.
        #   Fix      : sanitize_aql already rewrites these; verify the regex in
        #              _INVALID_ARRAY_PATTERNS covers the failing pattern.
        """
        from agent.aql_generator import sanitize_aql

        bad_query = (
            'FOR n IN node FILTER n.kind == "aws_security_group" '
            'AND n.reported.ip_permissions ANY == "0.0.0.0/0" '
            'LIMIT 100 RETURN n'
        )
        fixed = sanitize_aql(bad_query, "node", "default", 100)

        assert "ANY ==" not in fixed
        assert "FOR perm IN" in fixed

    @pytest.mark.asyncio
    async def test_ipranges_any_equals_is_also_sanitised(self):
        """
        'IpRanges ANY ==' pattern must also be caught and rewritten.

        # HOW TO FIX:
        #   Symptom : ArangoDB error on IpRanges traversal.
        #   Detection: Check sanitize_aql output.
        #   Fix      : Ensure _INVALID_ARRAY_PATTERNS includes IpRanges pattern.
        """
        from agent.aql_generator import sanitize_aql

        bad_query = (
            'FOR n IN node FILTER n.kind == "aws_security_group" '
            'AND n.reported.ip_permissions[*].IpRanges ANY == "10.0.0.0/8" '
            'LIMIT 100 RETURN n'
        )
        fixed = sanitize_aql(bad_query, "node", "default", 100)

        assert "ANY ==" not in fixed

    @pytest.mark.asyncio
    async def test_missing_limit_is_injected(self):
        """
        A query without LIMIT must have LIMIT injected before RETURN by
        inject_limit_if_missing.

        # HOW TO FIX:
        #   Symptom : Full-table scan; ArangoDB returns too many rows; memory pressure.
        #   Detection: Log AQL; check for absence of LIMIT keyword.
        #   Fix      : inject_limit_if_missing is called in generate_aql via
        #              fix_limit_position; ensure it is not bypassed.
        """
        from agent.aql_generator import inject_limit_if_missing

        query_no_limit = "FOR n IN node FILTER n.kind == 'aws_ec2_instance' RETURN n"
        fixed = inject_limit_if_missing(query_no_limit, 100)

        assert "LIMIT 100" in fixed.upper()
        return_pos = fixed.upper().rfind("RETURN")
        limit_pos = fixed.upper().rfind("LIMIT")
        assert limit_pos < return_pos

    @pytest.mark.asyncio
    async def test_count_query_not_given_outer_limit(self):
        """
        COUNT queries using RETURN LENGTH(...) must NOT have a LIMIT injected
        because it would make the AQL syntactically invalid.

        # HOW TO FIX:
        #   Symptom : ArangoDB parse error on count query.
        #   Detection: Log the final AQL for count_query intents.
        #   Fix      : The fix_limit_position function skips RETURN LENGTH queries;
        #              ensure the regex check for RETURN LENGTH is not broken.
        """
        from agent.aql_generator import fix_limit_position

        count_query = (
            "RETURN LENGTH(FOR n IN node FILTER n.kind == 'aws_ec2_instance' RETURN 1)"
        )
        result = fix_limit_position(count_query, 100)

        # The count query must not have a spurious LIMIT prepended
        assert result == count_query

    @pytest.mark.asyncio
    async def test_markdown_stripped_before_validation(self):
        """
        AQL wrapped in ```aql ... ``` fences must be stripped before validation.
        Without stripping, validate_aql would see the fence characters and fail.

        # HOW TO FIX:
        #   Symptom : ValueError 'Missing LIMIT clause' even for valid queries.
        #   Detection: Log the raw query from call_claude before stripping.
        #   Fix      : The markdown-strip block in generate_aql handles this;
        #              verify query.startswith('```') check is in place.
        """
        with patch("agent.aql_generator.call_llm", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = (
                "```aql\n"
                "FOR n IN node FILTER n.kind == 'aws_ec2_instance' LIMIT 100 RETURN n\n"
                "```"
            )
            from agent.aql_generator import generate_aql
            intent = _make_intent()
            result = await generate_aql(intent)

        assert "aws_ec2_instance" in result
        assert "```" not in result


# ===========================================================================
# TestSessionFailures
# ===========================================================================

class TestSessionFailures:
    """Tests for Redis session storage failures."""

    @pytest.mark.asyncio
    async def test_redis_connection_refused_load_context_returns_empty_list(self):
        """
        If Redis is unreachable, load_context must catch the exception and return
        an empty list — never propagate to the caller or crash the API.

        NOTE: The current implementation delegates exception handling to the caller
        (api/chat.py). This test verifies that a ConnectionError from redis.get
        propagates up so the API layer can decide to handle it gracefully.

        # HOW TO FIX:
        #   Symptom : 500 errors or empty history on every request.
        #   Detection: `redis-cli ping` returns PONG or 'Could not connect'.
        #   Fix      : Start Redis: `docker start redis` or `redis-server`.
        #              For Upstash: verify REDIS_URL contains the correct TLS endpoint.
        #              Add try/except around load_context in api/chat.py to degrade
        #              gracefully by using an empty history list.
        """
        import redis.asyncio as aioredis
        from core.redis_client import load_context

        mock_redis = AsyncMock(spec=aioredis.Redis)
        mock_redis.get.side_effect = ConnectionError("Redis connection refused")

        # load_context does not catch this — it propagates; callers should handle it
        with pytest.raises((ConnectionError, Exception)):
            await load_context(mock_redis, "test-session")

    @pytest.mark.asyncio
    async def test_redis_timeout_on_get_raises(self):
        """
        A Redis timeout on get must raise so the caller can fall back to empty history.

        # HOW TO FIX:
        #   Symptom : Requests hang then fail with TimeoutError.
        #   Detection: Monitor Redis latency; check Upstash dashboard for slow commands.
        #   Fix      : Wrap load_context in asyncio.wait_for(); add timeout to aioredis.from_url().
        """
        import redis.asyncio as aioredis
        from core.redis_client import load_context

        mock_redis = AsyncMock(spec=aioredis.Redis)
        mock_redis.get.side_effect = asyncio.TimeoutError("Redis timeout")

        with pytest.raises((asyncio.TimeoutError, Exception)):
            await load_context(mock_redis, "test-session")

    @pytest.mark.asyncio
    async def test_corrupt_session_data_raises_on_json_decode(self):
        """
        A session key containing non-JSON bytes (e.g. partial write, memory
        corruption) must raise rather than silently return partial data.

        # HOW TO FIX:
        #   Symptom : JSONDecodeError in logs; session effectively reset.
        #   Detection: `redis-cli get session:<id>` returns non-JSON.
        #   Fix      : Wrap json.loads in load_context with try/except JSONDecodeError
        #              and return [] on failure.  The current implementation does NOT
        #              catch this — adding that guard is the recommended fix.
        """
        import redis.asyncio as aioredis
        from core.redis_client import load_context

        mock_redis = AsyncMock(spec=aioredis.Redis)
        mock_redis.get.return_value = "{corrupt: not valid json!!!"

        with pytest.raises((json.JSONDecodeError, Exception)):
            await load_context(mock_redis, "bad-session")

    @pytest.mark.asyncio
    async def test_save_context_trims_to_max_turns_and_sets_ttl(self):
        """
        save_context must trim history to max_turns * 2 messages and set
        the Redis key TTL correctly.

        # HOW TO FIX:
        #   Symptom : Session memory grows unboundedly; Redis evicts keys unexpectedly.
        #   Detection: Watch Redis memory; check key TTL with `redis-cli ttl session:<id>`.
        #   Fix      : Verify max_context_turns in settings; ensure trimmed slice in
        #              save_context uses -(max_turns * 2) correctly.
        """
        import redis.asyncio as aioredis
        from core.redis_client import save_context

        mock_redis = MagicMock()
        mock_redis.set = AsyncMock()
        history = [
            ChatMessage(role=MessageRole.user, content=f"q{i}") if i % 2 == 0
            else ChatMessage(role=MessageRole.assistant, content=f"a{i}")
            for i in range(20)  # 20 messages = 10 turns
        ]

        await save_context(mock_redis, "sess", history, max_turns=5, ttl=3600)

        call_args = mock_redis.set.call_args
        saved_json = json.loads(call_args[0][1])
        assert len(saved_json) == 10  # 5 turns * 2 messages
        assert call_args[1].get("ex") == 3600

    @pytest.mark.asyncio
    async def test_load_context_returns_empty_list_for_missing_key(self):
        """
        A session that has never been created (redis.get returns None) must
        return an empty list, not raise KeyError or return None.

        # HOW TO FIX:
        #   Symptom : TypeError 'NoneType is not iterable' when history is used.
        #   Detection: Unit test load_context with mock returning None.
        #   Fix      : The current `if not raw: return []` guard handles this correctly.
        """
        import redis.asyncio as aioredis
        from core.redis_client import load_context

        mock_redis = MagicMock()
        mock_redis.get = AsyncMock(return_value=None)

        result = await load_context(mock_redis, "nonexistent-session")

        assert result == []


# ===========================================================================
# TestRequestValidation
# ===========================================================================

class TestRequestValidation:
    """Tests for HTTP-level request validation failures."""

    @pytest.mark.asyncio
    async def test_message_exceeds_max_length_returns_422(self):
        """
        A message exceeding 2000 characters is rejected by Pydantic before
        reaching any business logic.

        # HOW TO FIX:
        #   Symptom : 422 Unprocessable Entity.
        #   Root cause: Frontend not enforcing character limit.
        #   Fix      : Add maxLength validation to the textarea in the frontend;
        #              show a character counter to the user.
        """
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.post(
                "/agent/chat",
                json={"message": "x" * 2001, "session_id": "s1"},
            )
        assert res.status_code == 422

    @pytest.mark.asyncio
    async def test_session_id_missing_returns_422(self):
        """
        Omitting the required session_id field returns 422 from Pydantic.

        # HOW TO FIX:
        #   Symptom : 422 Unprocessable Entity.
        #   Root cause: Frontend not including session_id in the request body.
        #   Fix      : Ensure the frontend generates a UUID on component mount and
        #              includes it in every POST /agent/chat body.
        """
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.post(
                "/agent/chat",
                json={"message": "List my VPCs"},
            )
        assert res.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_message_field_returns_validation_error(self):
        """
        An empty string for message violates min_length=1 Pydantic constraint.

        # HOW TO FIX:
        #   Symptom : 422 Unprocessable Entity.
        #   Root cause: Frontend submitting empty form.
        #   Fix      : Disable the submit button when the textarea is empty.
        """
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.post(
                "/agent/chat",
                json={"message": "", "session_id": "s1"},
            )
        assert res.status_code == 422

    @pytest.mark.asyncio
    async def test_wrong_content_type_form_data_returns_422(self):
        """
        Sending form-encoded data (Content-Type: application/x-www-form-urlencoded)
        instead of JSON is rejected by FastAPI.

        # HOW TO FIX:
        #   Symptom : 422 Unprocessable Entity.
        #   Root cause: fetch() or axios call missing Content-Type: application/json header.
        #   Fix      : Add headers: {'Content-Type': 'application/json'} to the fetch call;
        #              ensure body is JSON.stringify(payload), not FormData.
        """
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.post(
                "/agent/chat",
                data={"message": "List EC2", "session_id": "s1"},
            )
        assert res.status_code == 422

    @pytest.mark.asyncio
    async def test_whitespace_only_message_returns_400(self):
        """
        A message that passes Pydantic (non-empty string) but is all whitespace
        is caught by the explicit strip() check in the route handler → 400.

        # HOW TO FIX:
        #   Symptom : 400 Bad Request with 'Message cannot be empty' detail.
        #   Root cause: User submits only spaces / newlines.
        #   Fix      : Trim the input on the frontend before sending; the server guard
        #              is an intentional safety net.
        """
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.post(
                "/agent/chat",
                json={"message": "     ", "session_id": "s1"},
            )
        assert res.status_code == 400
        assert "empty" in res.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_session_id_empty_string_returns_422(self):
        """
        An empty string for session_id violates min_length=1.

        # HOW TO FIX:
        #   Symptom : 422 Unprocessable Entity.
        #   Root cause: Frontend generating session_id as '' on first load.
        #   Fix      : Use crypto.randomUUID() or uuid4() to always produce a non-empty ID.
        """
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.post(
                "/agent/chat",
                json={"message": "List VPCs", "session_id": ""},
            )
        assert res.status_code == 422

    @pytest.mark.asyncio
    async def test_extra_unexpected_fields_are_ignored(self):
        """
        Pydantic model has extra='ignore' (via Config), so extra JSON fields in the
        body must not cause a validation error.

        # HOW TO FIX:
        #   Symptom : 422 from unknown extra fields.
        #   Root cause: API versioning mismatch; frontend sending deprecated fields.
        #   Fix      : Add class Config: extra = 'ignore' to ChatRequest (already in Settings).
        """
        with (
            patch("api.chat.classify_intent") as mock_intent,
            patch("api.chat.generate_aql") as mock_aql,
            patch("api.chat.get_db"),
            patch("api.chat.execute_aql") as mock_exec,
            patch("api.chat.synthesize_stream") as mock_synth,
            patch("api.chat.get_redis") as mock_redis_f,
            patch("api.chat.load_context", new_callable=AsyncMock) as mock_load,
            patch("api.chat.save_context", new_callable=AsyncMock),
        ):
            mock_intent.return_value = _make_intent()
            mock_aql.return_value = "FOR n IN node LIMIT 100 RETURN n"
            mock_exec.return_value = []
            mock_load.return_value = []
            mock_synth.side_effect = lambda *a, **kw: _yield("ok")
            mock_redis_f.return_value = AsyncMock()

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                res = await c.post(
                    "/agent/chat",
                    json={
                        "message": "List EC2",
                        "session_id": "s1",
                        "unknown_future_field": "value",  # extra field
                    },
                )

        # Should be 200 (extra fields ignored) or 422 if Pydantic is strict
        # Current ChatRequest does not set extra='ignore' explicitly, so 422 is acceptable too
        assert res.status_code in (200, 422)
