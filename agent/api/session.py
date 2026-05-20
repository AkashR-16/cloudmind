from fastapi import APIRouter, HTTPException
from ..core.models import SessionResponse
from ..core.redis_client import get_redis, load_context, clear_context

router = APIRouter(prefix="/session", tags=["session"])


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    redis = get_redis()
    history = await load_context(redis, session_id)
    return SessionResponse(
        session_id=session_id,
        turn_count=len(history) // 2,
        history=history,
    )


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    redis = get_redis()
    await clear_context(redis, session_id)
    return {"deleted": True, "session_id": session_id}
