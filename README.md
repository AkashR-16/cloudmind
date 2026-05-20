# CloudMind — AI Agent for AWS Environment Q&A

Monorepo containing:
- `agent/` — FastAPI backend (AI agent pipeline, ArangoDB, Redis, Gemini)
- `web/`   — Next.js 14 frontend (Vercel, Clerk auth, streaming chat UI)

## Local Dev

```bash
# 1. Start Floci (simulated AWS)
#    See: https://github.com/floci-io/floci

# 2. Run FixInventory against Floci to populate ArangoDB
#    See: https://fixinventory.org/docs

# 3. Start backend
cd agent && pip install -r requirements.txt && uvicorn main:app --reload

# 4. Start frontend
cd web && npm install && npm run dev
```

## Environment Variables

Copy `agent/.env.example` → `agent/.env`
Copy `web/.env.example` → `web/.env.local`
