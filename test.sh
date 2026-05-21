#!/usr/bin/env bash
# CloudMind — run all test suites.
#
# Usage:
#   ./test.sh            # everything: backend + frontend unit + frontend e2e
#   ./test.sh backend    # pytest only
#   ./test.sh frontend   # vitest only
#   ./test.sh e2e        # playwright only
#   ./test.sh --no-e2e   # backend + frontend unit, skip e2e (faster)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PYTEST="$ROOT/agent/venv/bin/pytest"

ANSI_GREEN="\033[32m"
ANSI_RED="\033[31m"
ANSI_BLUE="\033[34m"
ANSI_DIM="\033[2m"
ANSI_BOLD="\033[1m"
ANSI_RESET="\033[0m"

header() { printf "\n%b━━ %s ━━%b\n" "$ANSI_BOLD$ANSI_BLUE" "$1" "$ANSI_RESET"; }
pass()   { printf "%b✓%b %s\n" "$ANSI_GREEN" "$ANSI_RESET" "$1"; }
fail()   { printf "%b✗%b %s\n" "$ANSI_RED"   "$ANSI_RESET" "$1"; }

# ── pre-flight ─────────────────────────────────────────────────────
[ -f "$PYTEST" ]                || { fail "agent/venv missing. Run: cd agent && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt"; exit 1; }
[ -d "$ROOT/web/node_modules" ] || { fail "web/node_modules missing. Run: cd web && npm install"; exit 1; }

MODE="${1:-all}"
case "$MODE" in
  all|backend|frontend|e2e|--no-e2e) ;;
  *) fail "Unknown arg: $MODE  (use: backend | frontend | e2e | --no-e2e)"; exit 1 ;;
esac

FAILED=()

run_backend() {
  header "Backend (pytest)"
  if (cd "$ROOT/agent" && "$PYTEST" --tb=short); then
    pass "Backend tests passed"
  else
    fail "Backend tests failed"
    FAILED+=("backend")
  fi
}

run_frontend_unit() {
  header "Frontend unit (vitest)"
  if (cd "$ROOT/web" && npx vitest run); then
    pass "Frontend unit tests passed"
  else
    fail "Frontend unit tests failed"
    FAILED+=("frontend")
  fi
}

run_e2e() {
  header "Frontend e2e (playwright)"
  if (cd "$ROOT/web" && npx playwright test --reporter=list); then
    pass "E2E tests passed"
  else
    fail "E2E tests failed"
    FAILED+=("e2e")
  fi
}

case "$MODE" in
  backend)   run_backend ;;
  frontend)  run_frontend_unit ;;
  e2e)       run_e2e ;;
  --no-e2e)  run_backend; run_frontend_unit ;;
  all)       run_backend; run_frontend_unit; run_e2e ;;
esac

# ── summary ───────────────────────────────────────────────────────
header "Summary"
if [ ${#FAILED[@]} -eq 0 ]; then
  pass "All requested suites passed."
  exit 0
else
  fail "Failed: ${FAILED[*]}"
  exit 1
fi
