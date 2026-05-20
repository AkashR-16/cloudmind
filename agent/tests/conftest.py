import pytest
import os

os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("ARANGO_HOST", "http://localhost:8529")
os.environ.setdefault("ARANGO_DB", "fix")
os.environ.setdefault("ARANGO_PASSWORD", "test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
