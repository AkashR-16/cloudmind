#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Starting infrastructure (ArangoDB + Redis)..."
docker compose -f "$ROOT/agent/docker-compose.yml" up -d arangodb redis

echo "▶ Starting FastAPI backend..."
cd "$ROOT/agent"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "▶ Starting Next.js frontend..."
cd "$ROOT/web"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ CloudMind running"
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose -f '$ROOT/agent/docker-compose.yml' stop arangodb redis" EXIT
wait
