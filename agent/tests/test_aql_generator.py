import pytest
from unittest.mock import patch, AsyncMock
from agent.aql_generator import validate_aql, generate_aql, inject_limit_if_missing
from core.models import Intent, IntentType


def test_validate_aql_rejects_remove():
    valid, reason = validate_aql("FOR n IN node REMOVE n IN node LIMIT 10")
    assert not valid
    assert "Write operation" in reason


def test_validate_aql_rejects_insert():
    valid, reason = validate_aql("INSERT {kind: 'test'} INTO node LIMIT 10")
    assert not valid


def test_validate_aql_rejects_update():
    valid, reason = validate_aql("UPDATE n WITH {name: 'hack'} IN node LIMIT 10")
    assert not valid


def test_validate_aql_rejects_missing_limit():
    valid, reason = validate_aql("FOR n IN node FILTER n.kind == 'aws_ec2_instance' RETURN n")
    assert not valid
    assert "LIMIT" in reason


def test_validate_aql_accepts_valid_query():
    valid, _ = validate_aql("FOR n IN node FILTER n.kind == 'aws_ec2_instance' LIMIT 100 RETURN n")
    assert valid


def test_inject_limit_if_missing_adds_limit():
    query = "FOR n IN node RETURN n"
    result = inject_limit_if_missing(query, 100)
    assert "LIMIT 100" in result


def test_inject_limit_if_missing_does_not_duplicate():
    query = "FOR n IN node LIMIT 50 RETURN n"
    result = inject_limit_if_missing(query, 100)
    assert result.count("LIMIT") == 1


@pytest.mark.asyncio
@patch("agent.aql_generator.call_llm", new_callable=AsyncMock)
async def test_generate_aql_for_valid_intent(mock_call):
    mock_call.return_value = "FOR n IN node FILTER n.kind == 'aws_ec2_instance' LIMIT 100 RETURN n"
    intent = Intent(
        type=IntentType.resource_query,
        entities={"resource_type": "aws_ec2_instance"},
        raw_question="Which EC2 instances are running?",
    )
    query = await generate_aql(intent)
    assert "aws_ec2_instance" in query
    assert "LIMIT" in query.upper()


@pytest.mark.asyncio
@patch("agent.aql_generator.call_llm", new_callable=AsyncMock)
async def test_generate_aql_raises_on_invalid_write(mock_call):
    mock_call.return_value = "REMOVE n IN node LIMIT 100"
    intent = Intent(
        type=IntentType.resource_query,
        entities={},
        raw_question="Delete all EC2 instances",
    )
    with pytest.raises(ValueError, match="validation"):
        await generate_aql(intent)


@pytest.mark.asyncio
async def test_generate_aql_returns_empty_for_unknown():
    intent = Intent(type=IntentType.unknown, raw_question="What is the weather?")
    result = await generate_aql(intent)
    assert result == ""
