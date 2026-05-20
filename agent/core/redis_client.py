import json
import redis.asyncio as aioredis
from core.config import get_settings
from core.models import ChatMessage


def get_redis() -> aioredis.Redis:
    settings = get_settings()
    url = settings.redis_url
    # Upstash requires TLS. Auto-upgrade redis:// → rediss:// for Upstash hosts.
    if "upstash.io" in url and url.startswith("redis://"):
        url = "rediss://" + url[len("redis://"):]
    if url.startswith("rediss://"):
        return aioredis.from_url(url, decode_responses=True, ssl_cert_reqs=None)
    return aioredis.from_url(url, decode_responses=True)


async def load_context(redis: aioredis.Redis, session_id: str) -> list[ChatMessage]:
    raw = await redis.get(f"session:{session_id}")
    if not raw:
        return []
    data = json.loads(raw)
    return [ChatMessage(**m) for m in data]


async def save_context(
    redis: aioredis.Redis,
    session_id: str,
    history: list[ChatMessage],
    max_turns: int,
    ttl: int,
) -> None:
    # Keep only the most recent max_turns pairs (user + assistant = 1 turn = 2 messages)
    trimmed = history[-(max_turns * 2):]
    await redis.set(
        f"session:{session_id}",
        json.dumps([m.model_dump() for m in trimmed]),
        ex=ttl,
    )


async def clear_context(redis: aioredis.Redis, session_id: str) -> None:
    await redis.delete(f"session:{session_id}")
