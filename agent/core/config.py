from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    gemini_api_key: str
    arango_host: str = "http://localhost:8529"
    arango_db: str = "fixinventory"
    arango_username: str = "root"
    arango_password: str = ""
    redis_url: str = "redis://localhost:6379"
    # Comma-separated list of allowed CORS origins
    frontend_url: str = "http://localhost:3000"
    session_ttl_seconds: int = 86400
    max_context_turns: int = 10
    agent_timeout_seconds: int = 20
    aql_result_limit: int = 100

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
