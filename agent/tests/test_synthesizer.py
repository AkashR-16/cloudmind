import pytest
from agent.synthesizer import _build_messages
from core.models import Intent, IntentType, ChatMessage, MessageRole


def make_intent(q: str = "How many EC2?") -> Intent:
    return Intent(type=IntentType.resource_query, entities={}, raw_question=q)


def make_history(pairs: list[tuple[str, str]]) -> list[ChatMessage]:
    msgs = []
    for u, a in pairs:
        msgs.append(ChatMessage(role=MessageRole.user, content=u))
        msgs.append(ChatMessage(role=MessageRole.assistant, content=a))
    return msgs


# ── _build_messages: data scenarios ─────────────────────────────

def test_build_messages_injects_db_results():
    msgs = _build_messages(make_intent(), [{"id": "i-123", "name": "web"}], [])
    system = msgs[0]["parts"][0]
    assert "i-123" in system
    assert "web" in system


def test_build_messages_empty_results_says_no_resources():
    msgs = _build_messages(make_intent(), [], [])
    system = msgs[0]["parts"][0]
    assert "No matching resources found" in system


def test_build_messages_aql_error_does_not_say_no_resources():
    msgs = _build_messages(make_intent(), [], [], aql_error="AQL ERR 1501")
    system = msgs[0]["parts"][0]
    assert "QUERY FAILED" in system
    assert "No matching resources found" not in system


def test_build_messages_aql_error_instructs_rephrase():
    msgs = _build_messages(make_intent(), [], [], aql_error="some db error")
    system = msgs[0]["parts"][0]
    assert "rephrase" in system.lower()


def test_build_messages_question_appears_at_end():
    intent = make_intent("List all VPCs")
    msgs = _build_messages(intent, [], [])
    last = msgs[-1]
    assert last["role"] == "user"
    assert "List all VPCs" in last["parts"][0]


# ── _build_messages: conversation history ───────────────────────

def test_build_messages_appends_history_in_order():
    history = make_history([("q1", "a1"), ("q2", "a2")])
    msgs = _build_messages(make_intent(), [], history)
    # messages: [system, ack, user:q1, model:a1, user:q2, model:a2, user:question]
    roles = [m["role"] for m in msgs]
    assert roles == ["user", "model", "user", "model", "user", "model", "user"]


def test_build_messages_no_history_produces_three_messages():
    msgs = _build_messages(make_intent(), [], [])
    assert len(msgs) == 3  # system, ack, question


def test_build_messages_history_content_is_correct():
    history = make_history([("what regions?", "us-east-1")])
    msgs = _build_messages(make_intent("follow-up"), [], history)
    user_msg = msgs[2]
    model_msg = msgs[3]
    assert user_msg["parts"][0] == "what regions?"
    assert model_msg["parts"][0] == "us-east-1"


def test_build_messages_system_includes_intent_type():
    msgs = _build_messages(make_intent(), [], [])
    system = msgs[0]["parts"][0]
    assert "resource_query" in system


def test_build_messages_system_includes_entities():
    intent = Intent(
        type=IntentType.resource_query,
        entities={"resource_type": "aws_s3_bucket"},
        raw_question="list buckets",
    )
    msgs = _build_messages(intent, [], [])
    system = msgs[0]["parts"][0]
    assert "aws_s3_bucket" in system
