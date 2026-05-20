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


@app.get("/debug/arango")
async def debug_arango():
    """Temporary: reveal ArangoCloud connection state and collection stats."""
    from core.arango_client import get_db, get_collections
    try:
        db = get_db()
        vertex_col, edge_col = get_collections()
        vcol = db.collection(vertex_col)
        ecol = db.collection(edge_col)
        sample = list(db.aql.execute(
            f"FOR n IN {vertex_col} LIMIT 2 RETURN {{k: n._key, kind: n.kind, rk: n.reported.kind}}"
        ))
        return {
            "db": db.name,
            "vertex_col": vertex_col,
            "edge_col": edge_col,
            "vertex_count": vcol.count(),
            "edge_count": ecol.count(),
            "sample": sample,
        }
    except Exception as e:
        return {"error": str(e), "db": settings.arango_db, "vertex": settings.arango_vertex_collection}
