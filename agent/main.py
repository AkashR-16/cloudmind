from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from api.chat import router as chat_router
from api.session import router as session_router
from api.graph import router as graph_router

settings = get_settings()

app = FastAPI(
    title="CloudMind Agent",
    description="AI agent for AWS environment Q&A powered by Gemini + FixInventory",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(session_router)
app.include_router(graph_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
