from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis

from core.models import ChatRequest, ChatMessage, MessageRole
from core.config import get_settings
from core.arango_client import get_db, execute_aql
from core.redis_client import get_redis, load_context, save_context
from core.llm_router import is_local_mode
from agent.intent import classify_intent
from agent.aql_generator import generate_aql
from agent.synthesizer import synthesize_stream, synthesize_unknown

router = APIRouter(prefix="/agent", tags=["agent"])


async def _stream_response(request: ChatRequest) -> StreamingResponse:
    settings = get_settings()
    redis: aioredis.Redis = get_redis()
    api_key = request.api_key or None
    provider = request.provider.value if request.provider else None

    history = await load_context(redis, request.session_id)

    try:
        intent = await classify_intent(request.message, history=history, api_key=api_key, provider=provider)
    except RuntimeError as e:
        if "RESOURCE_EXHAUSTED" in str(e):
            raise HTTPException(
                status_code=429,
                detail="API rate limit reached. Please wait a moment and try again.",
            )
        raise

    if intent.type.value == "unknown":
        async def _unknown_gen():
            async for chunk in synthesize_unknown(request.message):
                yield chunk
        return StreamingResponse(_unknown_gen(), media_type="text/plain")

    aql_error: str | None = None
    try:
        aql_query = await generate_aql(intent, api_key=api_key, provider=provider)
        db = get_db()
        db_results = execute_aql(db, aql_query)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower() or "429" in err:
            raise HTTPException(
                status_code=429,
                detail="API rate limit reached. Please wait a moment and try again.",
            )
        aql_error = err
        db_results = []

    full_response: list[str] = []

    async def _gen():
        async for chunk in synthesize_stream(intent, db_results, history, aql_error=aql_error, api_key=api_key, provider=provider):
            full_response.append(chunk)
            yield chunk

        new_history = history + [
            ChatMessage(role=MessageRole.user, content=request.message),
            ChatMessage(role=MessageRole.assistant, content="".join(full_response)),
        ]
        await save_context(
            redis,
            request.session_id,
            new_history,
            settings.max_context_turns,
            settings.session_ttl_seconds,
        )

    return StreamingResponse(_gen(), media_type="text/plain")


@router.post("/chat")
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not is_local_mode() and not request.api_key:
        raise HTTPException(
            status_code=401,
            detail="No API key provided. Enter your Gemini API key to use CloudMind.",
        )

    return await _stream_response(request)
