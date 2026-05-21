"""
Tests for agent/synthesizer.py — specifically:
  - _build_cli_prompt  (pure function, no I/O)
  - synthesize_stream  (async generator wrapping stream_claude)
  - synthesize_unknown (async generator, no external calls)

Does NOT duplicate tests already in test_synthesizer.py which covers
_build_messages thoroughly.
"""

import json
import pytest
from unittest.mock import patch
from core.models import Intent, IntentType, ChatMessage, MessageRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_intent(
    q: str = "Which EC2 instances are running?",
    intent_type: IntentType = IntentType.resource_query,
    entities: dict | None = None,
) -> Intent:
    return Intent(
        type=intent_type,
        entities=entities or {"resource_type": "aws_ec2_instance"},
        raw_question=q,
    )


def make_history(pairs: list[tuple[str, str]]) -> list[ChatMessage]:
    msgs = []
    for user_msg, asst_msg in pairs:
        msgs.append(ChatMessage(role=MessageRole.user, content=user_msg))
        msgs.append(ChatMessage(role=MessageRole.assistant, content=asst_msg))
    return msgs


async def fake_stream(*chunks: str):
    """Async generator helper — yields each positional string argument."""
    for c in chunks:
        yield c


# ---------------------------------------------------------------------------
# _build_cli_prompt — pure function tests
# ---------------------------------------------------------------------------

def test_build_cli_prompt_includes_system_prompt_content():
    """The system prompt must appear at the very beginning of the combined prompt."""
    from agent.synthesizer import _build_cli_prompt

    system = "You are CloudMind, an expert AWS assistant."
    messages = [{"role": "user", "content": "How many VPCs?"}]
    prompt = _build_cli_prompt(system, messages)

    assert prompt.startswith(system)


def test_build_cli_prompt_includes_final_question_at_end():
    """The last message's content must appear at the tail of the prompt string."""
    from agent.synthesizer import _build_cli_prompt

    system = "System instructions here."
    messages = [{"role": "user", "content": "List all S3 buckets"}]
    prompt = _build_cli_prompt(system, messages)

    assert prompt.endswith("User: List all S3 buckets")


def test_build_cli_prompt_no_history_produces_system_plus_question_only():
    """With no conversation history (single message), the prompt is system + question."""
    from agent.synthesizer import _build_cli_prompt

    system = "AWS assistant."
    messages = [{"role": "user", "content": "How many IAM roles?"}]
    prompt = _build_cli_prompt(system, messages)

    assert "AWS assistant." in prompt
    assert "How many IAM roles?" in prompt
    # No User:/Assistant: labels for prior turns should appear
    assert "Assistant:" not in prompt


def test_build_cli_prompt_includes_history_with_user_label():
    """Prior user messages must be prefixed with 'User:'."""
    from agent.synthesizer import _build_cli_prompt

    system = "System."
    messages = [
        {"role": "user", "content": "What regions are available?"},
        {"role": "assistant", "content": "us-east-1 and eu-west-1."},
        {"role": "user", "content": "How many EC2 in us-east-1?"},
    ]
    prompt = _build_cli_prompt(system, messages)

    assert "User: What regions are available?" in prompt


def test_build_cli_prompt_includes_history_with_assistant_label():
    """Prior assistant messages must be prefixed with 'Assistant:'."""
    from agent.synthesizer import _build_cli_prompt

    system = "System."
    messages = [
        {"role": "user", "content": "What regions?"},
        {"role": "assistant", "content": "us-east-1"},
        {"role": "user", "content": "How many EC2?"},
    ]
    prompt = _build_cli_prompt(system, messages)

    assert "Assistant: us-east-1" in prompt


def test_build_cli_prompt_history_order_is_preserved():
    """History messages must appear in chronological order before the final question."""
    from agent.synthesizer import _build_cli_prompt

    system = "System."
    messages = [
        {"role": "user", "content": "first question"},
        {"role": "assistant", "content": "first answer"},
        {"role": "user", "content": "second question"},
        {"role": "assistant", "content": "second answer"},
        {"role": "user", "content": "third question"},
    ]
    prompt = _build_cli_prompt(system, messages)

    pos_first = prompt.index("first question")
    pos_second = prompt.index("second question")
    pos_third = prompt.index("third question")

    assert pos_first < pos_second < pos_third


def test_build_cli_prompt_final_question_not_labelled_as_prior_turn():
    """
    The last message is appended as 'User: <content>' at the very end.
    It must NOT also appear labeled in the middle of the history block.
    """
    from agent.synthesizer import _build_cli_prompt

    system = "System."
    messages = [
        {"role": "user", "content": "prior question"},
        {"role": "assistant", "content": "prior answer"},
        {"role": "user", "content": "final unique question xyz"},
    ]
    prompt = _build_cli_prompt(system, messages)

    # 'final unique question xyz' should appear exactly once
    assert prompt.count("final unique question xyz") == 1


def test_build_cli_prompt_single_message_no_labels_for_prior_turns():
    """
    Single message list (no history) must not inject empty User:/Assistant: labels.
    """
    from agent.synthesizer import _build_cli_prompt

    system = "System."
    messages = [{"role": "user", "content": "standalone question"}]
    prompt = _build_cli_prompt(system, messages)

    # The prompt should not have extra blank "User: " or "Assistant: " lines
    lines = prompt.splitlines()
    empty_role_lines = [l for l in lines if l.strip() in ("User:", "Assistant:")]
    assert empty_role_lines == []


# ---------------------------------------------------------------------------
# synthesize_unknown
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_synthesize_unknown_yields_string_containing_aws():
    """synthesize_unknown must mention AWS in its response."""
    from agent.synthesizer import synthesize_unknown

    chunks = [c async for c in synthesize_unknown("What is 2+2?")]
    full = "".join(chunks)
    assert "AWS" in full


@pytest.mark.asyncio
async def test_synthesize_unknown_yields_string_containing_scope():
    """synthesize_unknown must communicate that the question is out of scope."""
    from agent.synthesizer import synthesize_unknown

    chunks = [c async for c in synthesize_unknown("Tell me a joke")]
    full = "".join(chunks)
    assert "scope" in full.lower()


@pytest.mark.asyncio
async def test_synthesize_unknown_echoes_the_question_back():
    """The user's original question should be quoted in the response."""
    from agent.synthesizer import synthesize_unknown

    question = "What is the capital of France?"
    chunks = [c async for c in synthesize_unknown(question)]
    full = "".join(chunks)
    assert question in full


@pytest.mark.asyncio
async def test_synthesize_unknown_yields_at_least_one_chunk():
    """synthesize_unknown must always yield something — never an empty generator."""
    from agent.synthesizer import synthesize_unknown

    chunks = [c async for c in synthesize_unknown("random question")]
    assert len(chunks) >= 1
    assert any(len(c) > 0 for c in chunks)


# ---------------------------------------------------------------------------
# synthesize_stream — delegates to stream_llm
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_synthesize_stream_calls_stream_claude_with_combined_prompt():
    """synthesize_stream must invoke stream_llm exactly once with the built prompt."""
    from agent.synthesizer import synthesize_stream

    captured_prompts: list[str] = []

    async def mock_stream_llm(prompt: str, **_):
        captured_prompts.append(prompt)
        yield "response chunk"

    with patch("agent.synthesizer.stream_llm", side_effect=mock_stream_llm):
        intent = make_intent()
        _ = [c async for c in synthesize_stream(intent, [], [])]

    assert len(captured_prompts) == 1
    assert len(captured_prompts[0]) > 0


@pytest.mark.asyncio
async def test_synthesize_stream_yields_chunks_from_stream_claude():
    """Each chunk from stream_llm must be forwarded without modification."""
    from agent.synthesizer import synthesize_stream

    with patch("agent.synthesizer.stream_llm") as mock_sc:
        mock_sc.return_value = fake_stream("Hello", " world", "!")

        intent = make_intent()
        chunks = [c async for c in synthesize_stream(intent, [], [])]

    assert chunks == ["Hello", " world", "!"]


@pytest.mark.asyncio
async def test_synthesize_stream_yields_chunks_in_order():
    """Chunks must be yielded in the exact order stream_llm emits them."""
    from agent.synthesizer import synthesize_stream

    expected = [f"chunk{i}" for i in range(10)]

    with patch("agent.synthesizer.stream_llm") as mock_sc:
        mock_sc.return_value = fake_stream(*expected)
        intent = make_intent()
        result = [c async for c in synthesize_stream(intent, [], [])]

    assert result == expected


@pytest.mark.asyncio
async def test_synthesize_stream_with_aql_error_includes_query_failed_in_prompt():
    """
    When aql_error is set, the prompt passed to stream_llm must contain
    the 'QUERY FAILED' marker so the model knows to ask the user to rephrase.
    """
    from agent.synthesizer import synthesize_stream

    captured: list[str] = []

    async def capturing_stream(prompt: str, **_):
        captured.append(prompt)
        yield "query could not be completed"

    with patch("agent.synthesizer.stream_llm", side_effect=capturing_stream):
        intent = make_intent()
        _ = [c async for c in synthesize_stream(intent, [], [], aql_error="DB connection refused")]

    assert len(captured) == 1
    assert "QUERY FAILED" in captured[0]


@pytest.mark.asyncio
async def test_synthesize_stream_with_empty_db_results_includes_no_matching_resources():
    """
    Empty db_results (not an AQL error) should include 'No matching resources'
    in the prompt so the model accurately reports there are no results.
    """
    from agent.synthesizer import synthesize_stream

    captured: list[str] = []

    async def capturing_stream(prompt: str, **_):
        captured.append(prompt)
        yield "no resources found"

    with patch("agent.synthesizer.stream_llm", side_effect=capturing_stream):
        intent = make_intent()
        _ = [c async for c in synthesize_stream(intent, [], [])]  # empty list, no error

    assert len(captured) == 1
    assert "No matching resources" in captured[0]


@pytest.mark.asyncio
async def test_synthesize_stream_with_db_results_includes_json_data():
    """
    Non-empty db_results must be serialised as JSON and injected into the prompt
    so the model can reference actual resource data.
    """
    from agent.synthesizer import synthesize_stream

    captured: list[str] = []
    db_results = [
        {"id": "i-0abc123", "name": "web-server", "region": "us-east-1"},
        {"id": "i-0def456", "name": "db-server", "region": "us-west-2"},
    ]

    async def capturing_stream(prompt: str, **_):
        captured.append(prompt)
        yield "Here are your instances."

    with patch("agent.synthesizer.stream_llm", side_effect=capturing_stream):
        intent = make_intent()
        _ = [c async for c in synthesize_stream(intent, db_results, [])]

    assert len(captured) == 1
    assert "i-0abc123" in captured[0]
    assert "web-server" in captured[0]


@pytest.mark.asyncio
async def test_synthesize_stream_prompt_contains_intent_type():
    """
    The prompt passed to stream_llm should contain the intent type value
    (injected via _build_messages system string).
    """
    from agent.synthesizer import synthesize_stream

    captured: list[str] = []

    async def capturing_stream(prompt: str, **_):
        captured.append(prompt)
        yield "answer"

    with patch("agent.synthesizer.stream_llm", side_effect=capturing_stream):
        intent = make_intent(intent_type=IntentType.security_query)
        _ = [c async for c in synthesize_stream(intent, [], [])]

    assert "security_query" in captured[0]


@pytest.mark.asyncio
async def test_synthesize_stream_prompt_contains_raw_question():
    """
    The user's original question should appear in the prompt so the model
    has the full context of what was asked.
    """
    from agent.synthesizer import synthesize_stream

    captured: list[str] = []

    async def capturing_stream(prompt: str, **_):
        captured.append(prompt)
        yield "answer"

    question = "Which S3 buckets have versioning disabled?"
    with patch("agent.synthesizer.stream_llm", side_effect=capturing_stream):
        intent = make_intent(q=question)
        _ = [c async for c in synthesize_stream(intent, [], [])]

    assert question in captured[0]


@pytest.mark.asyncio
async def test_synthesize_stream_with_history_includes_history_in_prompt():
    """
    Conversation history should be embedded into the prompt so the
    model has prior context for follow-up answers.
    """
    from agent.synthesizer import synthesize_stream

    captured: list[str] = []

    async def capturing_stream(prompt: str, **_):
        captured.append(prompt)
        yield "follow-up answer"

    history = make_history([("How many VPCs?", "You have 3 VPCs.")])

    with patch("agent.synthesizer.stream_llm", side_effect=capturing_stream):
        intent = make_intent(q="Are they in us-east-1?")
        _ = [c async for c in synthesize_stream(intent, [], history)]

    assert "How many VPCs?" in captured[0] or "You have 3 VPCs." in captured[0]


@pytest.mark.asyncio
async def test_synthesize_stream_returns_empty_when_stream_claude_yields_nothing():
    """
    If stream_llm emits no chunks (e.g. empty response), synthesize_stream
    must return an empty sequence without raising.
    """
    from agent.synthesizer import synthesize_stream

    async def empty_stream(prompt: str, **_):
        return
        yield  # make it a generator

    with patch("agent.synthesizer.stream_llm", side_effect=empty_stream):
        intent = make_intent()
        chunks = [c async for c in synthesize_stream(intent, [], [])]

    assert chunks == []
