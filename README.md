# CloudMind — AI Agent for AWS Environment Q&A

CloudMind turns plain-English questions about an AWS environment into grounded answers backed by real graph queries. It runs locally against a 5-container stack with no real AWS account required.

```
   You: "Which EC2 instances are running?"
        ↓
   Claude classifies intent → writes AQL → runs against ArangoDB → streams answer
        ↓
   You: web-server-01, api-server-01, worker-node-1 (us-east-1)
```

Monorepo:

- `agent/` — FastAPI backend (AI agent pipeline, ArangoDB, Redis, LLM router)
- `web/` — Next.js 14 frontend (streaming chat UI, settings, architecture viewer)
- `docs/` — Engineering design doc and test coverage audit
- `agent/docker-compose.yml` — the 5-container stack (arangodb, redis, floci, fixcore, fixworker)

---

## Quick Start

**One-button run:**

```bash
./run.sh
```

Brings up the 5-container stack, waits for ArangoDB to be healthy, seeds Floci with demo AWS resources, runs discovery into ArangoDB, then starts the FastAPI backend on `:8000` and the Next.js frontend on `:3000`. Open <http://localhost:3000> when it reports ready.

**One-button tests:**

```bash
./test.sh
```

Runs all 378 tests across backend (pytest), frontend unit (vitest), and frontend e2e (playwright).

---

## First-time setup

Before either script will work, install the per-language deps once:

```bash
# Backend (Python)
cd agent && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt && cd ..

# Frontend (Node)
cd web && npm install && cd ..

# Environment variables
cp agent/.env.example agent/.env
cp web/.env.example   web/.env.local
```

You also need **Docker Desktop running** for `./run.sh` to spin up the container stack.

---

## Run options

| Command              | What it does                                                               |
| -------------------- | -------------------------------------------------------------------------- |
| `./run.sh`           | Full stack + seed/discover + backend + frontend                            |
| `./run.sh --no-seed` | Same, but skip seeding (faster on restart when graph is already populated) |
| `./run.sh --stop`    | Stop containers + backend + frontend                                       |

After `./run.sh` is running:

| Service           | URL                                            |
| ----------------- | ---------------------------------------------- |
| Frontend          | <http://localhost:3000>                        |
| Backend `/health` | <http://localhost:8000/health>                 |
| ArangoDB UI       | <http://localhost:8529> (`root` / `cloudmind`) |
| Floci AWS sim     | <http://localhost:4566/_floci/health>          |
| fixcore           | <https://localhost:8900/system/ready>          |

Logs land in `/tmp/cloudmind-backend.log` and `/tmp/cloudmind-frontend.log`.

---

## Test options

| Command              | Suite                                               |
| -------------------- | --------------------------------------------------- |
| `./test.sh`          | All three suites (~5s backend + ~3s unit + ~3s e2e) |
| `./test.sh backend`  | pytest only (`agent/tests/`)                        |
| `./test.sh frontend` | vitest only (`web/tests/unit/`)                     |
| `./test.sh e2e`      | playwright only (`web/tests/e2e/`)                  |
| `./test.sh --no-e2e` | Backend + frontend unit (skip e2e for speed)        |

378 tests total: 210 backend, 132 frontend unit, 36 frontend e2e.

---

## Engineering documentation

- **[`docs/DESIGN.md`](docs/DESIGN.md)** — Engineering design document. Context, goals/non-goals, architecture, request lifecycle, 8 numbered design decisions with rationale, production risks, and open questions. Read this before making non-trivial changes.

---

## Architecture at a glance

```
SOURCE     ─▶  floci :4566        (simulates 47 AWS APIs locally)
                   │ boto3 with AWS_ENDPOINT_URL override
                   ▼
DISCOVERY  ─▶  fixworker  →  fixcore :8900
                                  │ writes vertices + edges
                                  ▼
STORAGE    ─▶  arangodb :8529   ◀── redis :6379 (per-session chat context)
                   │ AQL queries
                   ▼
APPLICATION ─▶ FastAPI :8000  ◀── Claude (local CLI in dev / API key in prod)
                   │
                   ▼
              Next.js :3000  (chat · architecture · settings)
```

Full diagram and component-by-component breakdown in [`docs/DESIGN.md`](docs/DESIGN.md).
