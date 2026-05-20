from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis

from core.models import ChatRequest, ChatMessage, MessageRole
from core.config import get_settings
from core.arango_client import get_db, execute_aql
from core.redis_client import get_redis, load_context, save_context
from agent.intent import classify_intent
from agent.aql_generator import generate_aql
from agent.synthesizer import synthesize_stream, synthesize_unknown

router = APIRouter(prefix="/agent", tags=["agent"])


async def _stream_response(request: ChatRequest) -> StreamingResponse:
    settings = get_settings()
    redis: aioredis.Redis = get_redis()

    history = await load_context(redis, request.session_id)

    try:
        intent = await classify_intent(request.message, history=history)
    except RuntimeError as e:
        if "RESOURCE_EXHAUSTED" in str(e):
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait a moment and try again.",
            )
        raise

    if intent.type.value == "unknown":
        async def _unknown_gen():
            async for chunk in synthesize_unknown(request.message):
                yield chunk
        return StreamingResponse(_unknown_gen(), media_type="text/plain")

    try:
        aql_query = await generate_aql(intent)
        db = get_db()
        db_results = execute_aql(db, aql_query)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower() or "429" in err:
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait a moment and try again.",
            )
        db_results = []

    full_response: list[str] = []

    async def _gen():
        async for chunk in synthesize_stream(intent, db_results, history):
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
    return await _stream_response(request)
