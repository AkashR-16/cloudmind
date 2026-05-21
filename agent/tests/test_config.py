"""
Tests for core.config.Settings — env var loading, defaults, CORS parsing.

Closes GAP-3 from docs/TEST-COVERAGE-AUDIT.md.
"""
import os
from importlib import reload

import pytest

from core import config as config_module


def _fresh_settings():
    """Reload the module so the lru_cached get_settings re-reads the environment."""
    reload(config_module)
    return config_module.get_settings()


# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

def test_defaults_resolve_when_no_env_overrides(monkeypatch):
    """Every Settings field must have a usable default."""
    # Strip every env var the model reads so we exercise pure defaults.
    for k in [
        "ARANGO_HOST", "ARANGO_DB", "ARANGO_USERNAME", "ARANGO_PASSWORD",
        "ARANGO_VERTEX_COLLECTION", "ARANGO_EDGE_COLLECTION",
        "GEMINI_API_KEY", "REDIS_URL", "FRONTEND_URL",
        "SESSION_TTL_SECONDS", "MAX_CONTEXT_TURNS",
        "AGENT_TIMEOUT_SECONDS", "AQL_RESULT_LIMIT",
    ]:
        monkeypatch.delenv(k, raising=False)
    s = _fresh_settings()
    assert s.arango_host == "http://localhost:8529"
    assert s.arango_db == "fix"
    assert s.arango_username == "root"
    assert s.arango_vertex_collection == "fix"
    assert s.arango_edge_collection == "fix_default"
    assert s.redis_url == "redis://localhost:6379"
    assert s.frontend_url == "http://localhost:3000"
    assert s.session_ttl_seconds == 86400
    assert s.max_context_turns == 10
    assert s.agent_timeout_seconds == 20
    assert s.aql_result_limit == 100
    assert s.gemini_api_key is None


# ---------------------------------------------------------------------------
# Env-var overrides
# ---------------------------------------------------------------------------

def test_env_var_overrides_take_effect(monkeypatch):
    """pydantic-settings precedence: os.environ overrides values from .env."""
    monkeypatch.setenv("ARANGO_HOST", "http://arango.prod:8529")
    monkeypatch.setenv("ARANGO_PASSWORD", "supersecret")
    monkeypatch.setenv("REDIS_URL", "redis://upstash.io:6379")
    monkeypatch.setenv("MAX_CONTEXT_TURNS", "25")
    monkeypatch.setenv("AQL_RESULT_LIMIT", "500")
    s = _fresh_settings()
    assert s.arango_host == "http://arango.prod:8529"
    assert s.arango_password == "supersecret"
    assert s.redis_url == "redis://upstash.io:6379"
    assert s.max_context_turns == 25
    assert s.aql_result_limit == 500


def test_numeric_env_vars_coerced_to_int(monkeypatch):
    monkeypatch.setenv("SESSION_TTL_SECONDS", "3600")
    monkeypatch.setenv("AGENT_TIMEOUT_SECONDS", "45")
    s = _fresh_settings()
    assert s.session_ttl_seconds == 3600
    assert isinstance(s.session_ttl_seconds, int)
    assert s.agent_timeout_seconds == 45


# ---------------------------------------------------------------------------
# CORS parsing — the cors_origins property
# ---------------------------------------------------------------------------

def test_cors_origins_single_value(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://app.example.com")
    s = _fresh_settings()
    assert s.cors_origins == ["https://app.example.com"]


def test_cors_origins_comma_separated_multiple(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://a.com,https://b.com,https://c.com")
    s = _fresh_settings()
    assert s.cors_origins == ["https://a.com", "https://b.com", "https://c.com"]


def test_cors_origins_strips_whitespace_around_each(monkeypatch):
    """Whitespace around comma-separated values must not leak into the origin list."""
    monkeypatch.setenv("FRONTEND_URL", "  https://a.com , https://b.com  ,https://c.com  ")
    s = _fresh_settings()
    assert s.cors_origins == ["https://a.com", "https://b.com", "https://c.com"]


def test_cors_origins_drops_empty_segments(monkeypatch):
    """Trailing commas, double commas, leading commas must not produce empty entries."""
    monkeypatch.setenv("FRONTEND_URL", "https://a.com,,https://b.com,")
    s = _fresh_settings()
    assert s.cors_origins == ["https://a.com", "https://b.com"]


def test_cors_origins_all_whitespace_yields_empty_list(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "  , ,  ")
    s = _fresh_settings()
    assert s.cors_origins == []


# ---------------------------------------------------------------------------
# Unknown env vars do not crash (extra="ignore")
# ---------------------------------------------------------------------------

def test_unknown_env_vars_ignored(monkeypatch):
    """Setting an unrelated env var must not raise."""
    monkeypatch.setenv("CLOUDMIND_NEW_FEATURE_FLAG", "true")
    # Should not raise
    _fresh_settings()
