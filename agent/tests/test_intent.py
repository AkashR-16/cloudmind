import pytest
from unittest.mock import patch, AsyncMock
from agent.intent import classify_intent
from core.models import IntentType


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classifies_ec2_query(mock_call):
    mock_call.return_value = '{"intent": "resource_query", "entities": {"resource_type": "aws_ec2_instance"}}'
    result = await classify_intent("Which EC2 instances are running?")
    assert result.type == IntentType.resource_query
    assert result.entities.get("resource_type") == "aws_ec2_instance"


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_classifies_security_query(mock_call):
    mock_call.return_value = '{"intent": "security_query", "entities": {"resource_type": "aws_s3_bucket"}}'
    result = await classify_intent("Which S3 buckets are publicly accessible?")
    assert result.type == IntentType.security_query


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_returns_unknown_for_out_of_scope(mock_call):
    mock_call.return_value = '{"intent": "unknown", "entities": {}}'
    result = await classify_intent("What is the weather in London?")
    assert result.type == IntentType.unknown


@pytest.mark.asyncio
@patch("agent.intent.call_llm", new_callable=AsyncMock)
async def test_handles_malformed_json_gracefully(mock_call):
    mock_call.return_value = "not valid json at all"
    result = await classify_intent("some question")
    assert result.type == IntentType.unknown
