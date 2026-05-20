import pytest
from unittest.mock import patch, MagicMock
from agent.aql_generator import _kind_field, _build_schema_context, _build_aql_prompt


def test_kind_field_returns_kind_for_legacy_schema():
    assert _kind_field("node") == "kind"


def test_kind_field_returns_reported_kind_for_fix_schema():
    assert _kind_field("fix") == "reported.kind"


def test_kind_field_returns_reported_kind_for_any_non_node_collection():
    assert _kind_field("resources") == "reported.kind"
    assert _kind_field("custom_col") == "reported.kind"


def test_schema_context_uses_kind_for_legacy():
    ctx = _build_schema_context("node", "default")
    assert "kind: string" in ctx
    assert "reported.kind" not in ctx.split("kind: string")[0]


def test_schema_context_uses_reported_kind_for_fix():
    ctx = _build_schema_context("fix", "fix_default")
    assert "reported.kind: string" in ctx


def test_aql_prompt_uses_correct_field_for_legacy():
    prompt = _build_aql_prompt("node", "default", "schema", 100, "EC2?", "resource_query", {})
    assert "n.kind ==" in prompt
    assert "n.reported.kind ==" not in prompt


def test_aql_prompt_uses_correct_field_for_fix_schema():
    prompt = _build_aql_prompt("fix", "fix_default", "schema", 100, "EC2?", "resource_query", {})
    assert "n.reported.kind ==" in prompt
    assert 'FILTER n.kind ==' not in prompt


def test_aql_prompt_includes_security_group_nested_array_example():
    prompt = _build_aql_prompt("fix", "fix_default", "schema", 100, "SG?", "security_query", {})
    assert "ip_permissions" in prompt
    assert "0.0.0.0/0" in prompt
