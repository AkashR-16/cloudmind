# CloudMind — Engineering Design Document

**Status:** Living document
**Last reviewed:** 2026-05-21
**Project slug:** `cloudmind`

---

## 1. Context

Engineers and SREs spend an inordinate amount of time answering basic questions about their AWS environment: *"Which EC2 instances are running in us-east-1?" "Which S3 buckets are public?" "Which security groups allow 0.0.0.0/0?"* Each of these is one Console click or one CLI invocation away — but discovering the right click or the right command requires institutional knowledge. The cost compounds at scale: 200 engineers, 20 accounts, dozens of services, and the question of "what do we actually have running" becomes a half-day exercise.

CloudMind reduces that to a sentence. A user types a plain-English question; the system writes the graph query, runs it against a discovered resource graph, and streams back a grounded answer. The user never sees AQL, never opens the AWS Console, and never needs to remember which boto3 method lists which resource type.

---

## 2. Goals & Non-Goals

### Goals
1. **One-sentence questions get accurate, grounded answers** — every response is backed by a real query against a real graph.
2. **No proprietary AWS account required to demo** — the same pipeline that runs against real AWS runs against a local AWS simulator (Floci), so the project ships as a self-contained demo.
3. **Provider-agnostic LLM layer** — local Claude CLI in dev, any of Anthropic / OpenAI / Gemini via API key in prod; no hard coupling to one vendor.
4. **Stateless backend, externalized session** — horizontal scaling stays cheap.
5. **Graph schema compatible with FixInventory** — so a production CloudMind instance can point at an existing FixInventory deployment and inherit its discovery work without re-implementation.

### Non-Goals (explicit out-of-scope)
1. **Mutation.** CloudMind reads. It does not stop instances, modify security groups, or change anything in your AWS account. AQL validation rejects writes at the agent layer.
2. **Real-time discovery.** Resource state is as fresh as the last fixworker collection. We are not building a live AWS event subscriber.
3. **Multi-tenant SaaS.** This is a single-tenant deployment per organization. No tenant isolation, no per-customer billing, no admin console.
4. **A full FixInventory replacement.** We use FixInventory's discovery components (fixworker + fixcore + their schema). We do not re-implement them.
5. **A general-purpose LLM agent.** CloudMind has one job: AWS resource questions. Off-topic questions return `intent=unknown` and a short redirect message.

---

## 3. High-Level Architecture

The system is organized as **three logical layers** running across **five containers + backend + frontend + LLM**:

```
┌─── SOURCE ────────────────────────────────────────────────────────────┐
│  Floci  :4566  ────  Simulates 47 AWS service APIs locally           │
└──────────────────────────────────────┬────────────────────────────────┘
                                       │ boto3 · AWS_ENDPOINT_URL override
                                       ▼
┌─── DISCOVERY ─────────────────────────────────────────────────────────┐
│  fixworker  ─────  Walks AWS APIs, normalizes to FixInventory schema │
│      │                                                                 │
│      ▼ PSK auth                                                       │
│  fixcore  :8900  ─  Orchestrates collection, writes graph to ArangoDB │
└──────────────────────────────────────┬────────────────────────────────┘
                                       │ vertices + edges
                                       ▼
┌─── STORAGE ───────────────────────────────────────────────────────────┐
│  arangodb  :8529  ─  Graph DB · database `fix` · vertex `fix`        │
│  redis     :6379  ─  Per-session chat context · TTL 24h              │
└──────────────────────────────────────┬────────────────────────────────┘
                                       │ AQL queries · session lookups
                                       ▼
┌─── APPLICATION ───────────────────────────────────────────────────────┐
│  backend  :8000  ─  FastAPI · intent → AQL → execute → synthesize    │
│                       │                                                │
│                       ▼ LLM router                                    │
│                   Claude CLI (dev) or Anthropic/OpenAI/Gemini (prod)  │
│                                                                        │
│  frontend :3000  ─  Next.js · streaming chat UI                       │
└────────────────────────────────────────────────────────────────────────┘
```

**Why this layering?** Each layer has a single responsibility and a single failure mode. Discovery can fail (stale data); storage can fail (503); LLM can fail (auth/quota); the layers are decoupled enough that a degradation in one is debuggable without spelunking through the others.

---

## 4. Component Responsibilities

| Component | Role | Image / Port | Owns |
|---|---|---|---|
| **floci** | AWS API simulator | `floci/floci` · `:4566` | Mocked state for 47 AWS services. Source of truth for the demo. |
| **fixworker** | Resource discovery | `someengineering/fixworker:4.2.0` | boto3 walks; emits resources + edges to fixcore. |
| **fixcore** | Graph orchestrator | `someengineering/fixcore:4.2.0` · `:8900` | Normalizes resources, schedules collections, writes to ArangoDB. |
| **arangodb** | Graph database | `arangodb:3.11.12` · `:8529` | Persistent resource graph (db=`fix`, vertices=`fix`, edges=`fix_default`). |
| **redis** | Session store | `redis:7-alpine` · `:6379` | Rolling chat history per session, 10-turn max, 24h TTL. |
| **backend** | Application API | FastAPI · `:8000` | `/agent/chat`, `/agent/mode`, `/agent/test-key`, `/session/*`, `/graph/*`. |
| **frontend** | User interface | Next.js · `:3000` | Chat UI, settings, architecture viewer, API-key management. |
| **Claude / LLM** | Reasoning | CLI binary (dev) or API (prod) | Intent classification, AQL generation, response synthesis. |

---

## 5. Request Lifecycle (Chat)

A single chat message traverses six well-defined stages. Each is independently testable and observable.

```
USER         │ "Which EC2 instances are running?"
             ▼
FRONTEND     │ POST /api/agent/chat { message, session_id, api_key?, provider? }
             ▼
BACKEND ─────│ chat.py:80
             │  1. Validate request (non-empty, length cap, key presence in prod)
             │  2. Load history from Redis by session_id
             │
             ├── INTENT (agent/intent.py:25)
             │     LLM call → JSON → Intent{type, entities, raw_question}
             │
             ├── AQL GEN (agent/aql_generator.py:179)
             │     LLM call → AQL string
             │     Sanitize: reject INSERT/UPDATE/REMOVE, require LIMIT
             │
             ├── EXECUTE (core/arango_client.py)
             │     db.aql.execute(query) → list[dict]
             │     On error: capture string, continue to synthesis with aql_error
             │
             ├── SYNTHESIZE (agent/synthesizer.py:66)
             │     stream_llm() → AsyncIterator[str]
             │     Yields tokens as they arrive
             │
             └── PERSIST (chat.py:65)
                   Append user + assistant messages to Redis history, set TTL
             ▼
FRONTEND     │ Streams tokens to UI, persists messages to localStorage on completion
```

**Two LLM calls per message** (intent + synthesis), plus one more (AQL generation) when intent ≠ unknown. This is a deliberate tradeoff:
- **Pro:** Each LLM call has one job, which keeps prompts simple and answers grounded. Intent failures don't poison synthesis; AQL failures don't suppress the answer.
- **Con:** Latency. Three sequential LLM calls = roughly 3–6 seconds before the first token streams. The frontend has a 20-second "almost there" placeholder to absorb cold starts.

---

## 6. Key Design Decisions

Each decision below is logged with **what we picked, what we rejected, and why**. Future-us reading this should be able to challenge the call with new context.

### D-1. Graph DB over relational DB
- **Pick:** ArangoDB (multi-model, AQL).
- **Rejected:** Postgres + JSON columns; Neptune (vendor lock + cost).
- **Why:** AWS resources form a graph (vpc → subnet → instance → eni → sg). Traversal queries are first-class. ArangoDB lets us use FixInventory's schema as-is.
- **Tradeoff:** Smaller operator pool than Postgres. Acceptable for a single-tenant deployment.

### D-2. FixInventory schema, not custom
- **Pick:** Adopt FixInventory's vertex/edge schema verbatim (`reported.kind`, `kinds[]`, edge collection `fix_default`).
- **Rejected:** A custom resource schema tuned for our query examples.
- **Why:** FixInventory has 4 years of resource modeling baked in. Re-inventing it would waste a quarter and immediately fork from their plugin ecosystem.
- **Tradeoff:** AQL queries include some FixInventory-isms (`kinds` is an array, not a string) that the LLM has to learn. Mitigated with explicit examples in the AQL-gen prompt.

### D-3. Three LLM calls per chat turn, not one
- **Pick:** Intent → AQL → Synthesis as three independent prompts.
- **Rejected:** One mega-prompt with tools.
- **Why:** Determinism and debuggability. When the answer is wrong, we know which stage failed. Tool-use latency is harder to predict on Anthropic's edge models.
- **Tradeoff:** ~2–3x the LLM cost per turn. Worth it for a demo; revisit if we ship at scale.

### D-4. LLM provider abstraction
- **Pick:** `llm_router.call_llm(prompt, api_key?, provider?)` — provider chosen at request time by frontend; falls back to local Claude CLI when no key is set.
- **Rejected:** Hard-coded Anthropic SDK in every callsite.
- **Why:** The demo audience is split between "I have an Anthropic key" and "I'm running this in my IDE with Claude Code logged in." We support both with one switch.
- **Tradeoff:** Four client implementations to keep in sync (Anthropic, OpenAI, Gemini, CLI). Streaming semantics differ between them; tests have to cover each path.

### D-5. Per-user API key in localStorage, not server env var
- **Pick:** Demo deploys with no Anthropic key on the server. Each visitor brings their own in Settings.
- **Rejected:** Server-side `ANTHROPIC_API_KEY` env var that all users share.
- **Why:** Public demo. Anyone who finds the URL can run up the server's bill. Putting the key on the user side moves cost + abuse to the user's quota.
- **Tradeoff:** Friction. Visitors without an Anthropic account bounce. Mitigated by the `ApiKeyBanner` and the Settings tab.

### D-6. Floci instead of LocalStack
- **Pick:** `floci/floci:latest` as the AWS simulator.
- **Rejected:** LocalStack (popular default).
- **Why:** Floci is leaner, has fewer host-port dependencies, and (importantly) fixworker has good coverage against it. LocalStack has historically been a moving target for fixworker.
- **Tradeoff:** Floci is less widely known; some service behaviors diverge from real AWS (e.g., EC2 instance state transitions). Mitigated by re-seeding before each demo.

### D-7. Backend stateless, session in Redis
- **Pick:** Chat history in Redis, keyed by client-generated session_id.
- **Rejected:** In-process LRU; per-user database row.
- **Why:** Stateless backend = trivial horizontal scale. Redis TTL bounds memory automatically.
- **Tradeoff:** Frontend has to own the session_id and survive page reloads. We persist it to `localStorage.cloudmind_session_id`.

### D-8. Read-only by construction
- **Pick:** AQL sanitizer rejects every write keyword before execution.
- **Rejected:** Trusting the LLM to never generate writes.
- **Why:** A chat agent that can mutate infrastructure is a foot-gun. Even if the LLM is fine 99.9% of the time, the tail is unacceptable.
- **Tradeoff:** None worth mentioning — read-only is a feature, not a limitation.

---

## 7. Production Readiness — What Could Wake Me Up at 3 AM

In rough order of likelihood × blast radius:

1. **LLM provider degradation (HIGH).** Anthropic 5xx or rate limit → every chat fails. Mitigation: surface 429 with a clear message (already done at `chat.py:50`); fallback to Claude CLI when available. Gap: no automatic failover between providers — a user with a saved Anthropic key has no path to OpenAI without going to Settings.

2. **ArangoDB connection saturation (MEDIUM).** Each chat opens a connection per request via the synchronous `python-arango` client. Under burst load this exhausts the pool. Mitigation today: none. Recommendation: pool sizing or move to the async ArangoDB driver before we promote beyond demo.

3. **Stale resource graph (MEDIUM).** fixworker's collection schedule is not enforced; we re-seed and re-discover manually. A demo user could see "running EC2 instances" that are now terminated. Mitigation: surface "last discovered" timestamp in the UI; auto-trigger collection on user-visible mismatch.

4. **API key leakage in logs (LOW–MEDIUM).** `api_key` is in the request body. If we ever log full request bodies (we don't today), we expose user keys. Recommendation: explicit redaction in `models.ChatRequest.__repr__` and never `print(request)`.

5. **Frontend session collision (LOW).** Two tabs of the same browser share `localStorage.cloudmind_session_id` and will write to the same Redis history. Currently this is the *correct* behavior (cross-tab continuity) but it interleaves messages weirdly if both tabs are active. Acceptable for the demo.

6. **Floci instance auto-termination bug (KNOWN).** Floci's EC2 simulator transitions instances to `terminated` if it can't allocate a host port. We hit this in this session when 30 zombie containers from a previous stack were holding ports. Mitigation already shipped: cleanup steps documented; not a production issue (this stack isn't a production component).

---

## 8. Open Questions

1. **Multi-account support.** Today the discovery pipeline points at one Floci instance. Production would point at multiple AWS accounts via cross-account roles. Where does that complexity live — in fixworker config, or in a routing layer above the backend?
2. **Cost telemetry.** We don't track LLM tokens per session. For a "bring your own key" demo this is fine; for a hosted product we need it before we ship.
3. **Role-specific prompts.** SREs ask different questions than security reviewers. Should the intent classifier branch into role-specific prompts, or do we ride one prompt as long as it holds?
4. **Resource-type coverage gaps.** AQL examples cover EC2, S3, IAM, security groups, RDS, Lambda. New resource types (EKS, ECS, Step Functions) need both schema awareness (for the LLM) and discovery (for fixworker). Tracking this in `tasks/` once we have evidence users are asking.

---

## 9. Repository Layout

```
cloudmind-main/
├── agent/                      ← FastAPI backend
│   ├── api/                    ← Routers: chat, session, graph
│   ├── agent/                  ← Pipeline: intent, aql_generator, synthesizer
│   ├── core/                   ← config, llm_router, arango_client, redis_client, LLM clients
│   ├── scripts/                ← seed_floci.py, discover.py
│   ├── tests/                  ← pytest (165 tests)
│   ├── docker-compose.yml      ← 5-container stack
│   └── requirements.txt
├── web/                        ← Next.js frontend
│   ├── app/(app)/dashboard/    ← Chat / How It Works / Architecture / Settings
│   ├── features/               ← useChat, useApiKey, useResources hooks
│   ├── components/             ← Layout + shared UI
│   └── tests/                  ← Vitest (104) + Playwright (16) + extended cases
├── docs/                       ← This document and other engineering docs
├── tasks/                      ← Task tracking (per claude-patterns workflow)
├── .claude-patterns/           ← Submodule: shared patterns library
├── CLAUDE.md                   ← Project Claude agent rules
├── render.yaml                 ← Render deployment manifest
└── README.md / SETUP.md
```

---

## 10. Summary

The architecture is sound for a public demo. The three real risks for shipping beyond demo are (a) connection pooling at the ArangoDB layer, (b) automatic LLM-provider failover, and (c) cost telemetry. None of those block today's milestone; (a) and (c) should block a "production" promotion at minimum.

**Follow-on work areas:**
- Test coverage gaps — see `docs/TEST-COVERAGE-AUDIT.md`.
- ArangoDB driver / pooling — revisit before production promotion.
- Frontend scale-out — if the dashboard grows beyond the current four tabs, expect to revisit the navigation and state architecture.
