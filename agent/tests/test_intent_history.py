"""Tests for intent classification with conversation history (follow-up context)."""
import pytest
from unittest.mock import patch, AsyncMock
from agent.intent import classify_intent
from core.models import IntentType, ChatMessage, MessageRole


def make_history(pairs: list[tuple[str, str]]) -> list[ChatMessage]:
    msgs = []
    for u, a in pairs:
        msgs.append(ChatMessage(role=MessageRole.user, content=u))
        msgs.append(ChatMessage(role=MessageRole.assistant, content=a))
    return msgs


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classify_intent_passes_history_to_gemini(mock_call):
    mock_call.return_value = '{"intent": "resource_query", "entities": {"resource_type": "aws_ec2_instance"}}'
    history = make_history([("How many EC2?", "You have 4 EC2 instances.")])

    await classify_intent("What types are they?", history=history)

    prompt_text = mock_call.call_args[0][0]
    assert "How many EC2?" in prompt_text or "You have 4" in prompt_text


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classify_intent_works_without_history(mock_call):
    mock_call.return_value = '{"intent": "resource_query", "entities": {}}'
    result = await classify_intent("List my VPCs", history=None)
    assert result.type == IntentType.resource_query


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classify_intent_with_empty_history(mock_call):
    mock_call.return_value = '{"intent": "resource_query", "entities": {}}'
    result = await classify_intent("List my VPCs", history=[])
    assert result.type == IntentType.resource_query


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classify_intent_only_uses_recent_history(mock_call):
    """Only the last 4 messages (2 turns) should be injected."""
    mock_call.return_value = '{"intent": "resource_query", "entities": {}}'
    history = make_history([
        ("old q1", "old a1"),
        ("old q2", "old a2"),
        ("recent q1", "recent a1"),
        ("recent q2", "recent a2"),
    ])

    await classify_intent("follow-up", history=history)

    prompt_text = mock_call.call_args[0][0]
    assert "recent q1" in prompt_text or "recent a1" in prompt_text or "recent q2" in prompt_text


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classify_intent_rds_query(mock_call):
    mock_call.return_value = '{"intent": "security_query", "entities": {"resource_type": "aws_rds_instance"}}'
    result = await classify_intent("Which RDS instances are not encrypted?")
    assert result.type == IntentType.security_query
    assert result.entities.get("resource_type") == "aws_rds_instance"


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classify_intent_count_query(mock_call):
    mock_call.return_value = '{"intent": "count_query", "entities": {"resource_type": "aws_vpc"}}'
    result = await classify_intent("How many VPCs do I have?")
    assert result.type.value in ("count_query", "resource_query")


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classify_intent_iam_query(mock_call):
    mock_call.return_value = '{"intent": "resource_query", "entities": {"resource_type": "aws_iam_role"}}'
    result = await classify_intent("List all IAM roles in my account")
    assert result.type == IntentType.resource_query
    assert result.entities.get("resource_type") == "aws_iam_role"
