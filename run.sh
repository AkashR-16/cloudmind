#!/usr/bin/env bash
# CloudMind — one-button local startup.
#
# Brings up the full 5-container stack (arangodb, redis, floci, fixcore,
# fixworker), seeds Floci with demo AWS resources if the graph is empty,
# then starts the FastAPI backend and Next.js frontend.
#
# Usage:
#   ./run.sh           # full stack + backend + frontend
#   ./run.sh --no-seed # skip the Floci seed/discover step (faster on restart)
#   ./run.sh --stop    # stop everything started by this script
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$ROOT/agent/docker-compose.yml"
PYTHON="$ROOT/agent/venv/bin/python"
UVICORN="$ROOT/agent/venv/bin/uvicorn"

ANSI_GREEN="\033[32m"
ANSI_YELLOW="\033[33m"
ANSI_RED="\033[31m"
ANSI_DIM="\033[2m"
ANSI_RESET="\033[0m"

say()  { printf "%b▶%b %s\n" "$ANSI_GREEN" "$ANSI_RESET" "$1"; }
warn() { printf "%b!%b %s\n" "$ANSI_YELLOW" "$ANSI_RESET" "$1"; }
fail() { printf "%b✗%b %s\n" "$ANSI_RED" "$ANSI_RESET" "$1"; exit 1; }
dim()  { printf "%b%s%b\n" "$ANSI_DIM" "$1" "$ANSI_RESET"; }

# ── flags ──────────────────────────────────────────────────────────
SEED=1
case "${1:-}" in
  --no-seed) SEED=0 ;;
  --stop)
    say "Stopping CloudMind stack…"
    docker compose -f "$COMPOSE_FILE" stop
    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "next dev"          2>/dev/null || true
    say "Stopped."
    exit 0
    ;;
  "") ;;
  *) fail "Unknown argument: $1 (use --no-seed or --stop)" ;;
esac

# ── pre-flight ─────────────────────────────────────────────────────
command -v docker >/dev/null || fail "docker is required (install Docker Desktop)."
[ -f "$PYTHON" ]   || fail "agent/venv missing. Run: cd agent && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt"
[ -d "$ROOT/web/node_modules" ] || fail "web/node_modules missing. Run: cd web && npm install"

# ── docker stack ───────────────────────────────────────────────────
say "Starting docker stack (arangodb, redis, floci, fixcore, fixworker)…"
docker compose -f "$COMPOSE_FILE" up -d

say "Waiting for ArangoDB healthcheck…"
for i in $(seq 1 24); do
  s=$(docker inspect agent-arangodb-1 --format '{{.State.Health.Status}}' 2>/dev/null || echo "missing")
  if [ "$s" = "healthy" ]; then break; fi
  if [ "$i" = "24" ]; then fail "ArangoDB never reached healthy state (waited 2 min). Check: docker logs agent-arangodb-1"; fi
  sleep 5
done
dim "  ArangoDB: healthy"

# ── seed + discover ────────────────────────────────────────────────
if [ "$SEED" = "1" ]; then
  # Only seed if the graph is empty — keep restarts fast.
  count=$(curl -sf -u root:cloudmind -H 'Content-Type: application/json' \
    -X POST 'http://localhost:8529/_db/fix/_api/cursor' \
    -d '{"query":"RETURN LENGTH(FOR n IN fix FILTER n.reported.kind == \"aws_ec2_instance\" RETURN 1)"}' \
    2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"][0])' 2>/dev/null || echo "0")

  if [ "$count" -eq 0 ] 2>/dev/null; then
    say "Seeding Floci with demo AWS resources…"
    (cd "$ROOT/agent" && "$PYTHON" scripts/seed_floci.py 2>&1) | tail -5

    say "Running discovery into ArangoDB…"
    (cd "$ROOT/agent" && "$PYTHON" scripts/discover.py 2>&1) | tail -5
  else
    dim "  Graph already populated (EC2 instances=$count) — skipping seed/discover."
  fi
else
  dim "  --no-seed: skipping seed/discover."
fi

# ── backend + frontend ─────────────────────────────────────────────
say "Starting FastAPI backend on :8000…"
cd "$ROOT/agent"
"$UVICORN" main:app --reload --host 0.0.0.0 --port 8000 > /tmp/cloudmind-backend.log 2>&1 &
BACKEND_PID=$!

say "Starting Next.js frontend on :3000…"
cd "$ROOT/web"
npm run dev > /tmp/cloudmind-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for both to be ready before reporting success
say "Waiting for services…"
for i in $(seq 1 30); do
  curl -sf http://localhost:8000/health >/dev/null 2>&1 && break
  [ "$i" = "30" ] && fail "Backend never came up. See /tmp/cloudmind-backend.log"
  sleep 1
done
for i in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:3000/ && break
  [ "$i" = "60" ] && fail "Frontend never came up. See /tmp/cloudmind-frontend.log"
  sleep 1
done

cat <<EOF

${ANSI_GREEN}✓${ANSI_RESET} CloudMind is up.

  Frontend → http://localhost:3000
  Backend  → http://localhost:8000/health
  ArangoDB → http://localhost:8529  (root / cloudmind)
  Floci    → http://localhost:4566/_floci/health
  fixcore  → https://localhost:8900/system/ready

Logs:
  tail -f /tmp/cloudmind-backend.log
  tail -f /tmp/cloudmind-frontend.log

Stop everything: ./run.sh --stop
Or Ctrl+C in this terminal (only stops backend + frontend; containers keep running).

EOF

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo; warn "Backend + frontend stopped. Containers still running — use ./run.sh --stop to shut those down too."' EXIT
wait
