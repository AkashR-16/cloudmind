# CloudMind — Full Setup Guide

## Prerequisites

- Docker + Docker Compose
- Python 3.11+
- Node.js 20+
- A [Gemini API key](https://ai.google.dev/)
- A [Clerk account](https://clerk.com) (free tier works)

---

## Step 1 — Start ArangoDB and Redis

```bash
cd cloudmind/agent
docker compose up -d
```

ArangoDB will be available at http://localhost:8529 (root / cloudmind)
Redis will be available at localhost:6379

---

## Step 2 — Start Floci (Simulated AWS)

Follow the Floci setup at https://github.com/floci-io/floci

Floci exposes a fake AWS API endpoint locally. Once running, note the endpoint URL.

---

## Step 3 — Run FixInventory against Floci

FixInventory (https://fixinventory.org/) scans cloud environments and stores the
resource graph in ArangoDB.

```bash
# Install FixInventory CLI
pip install fixinventory

# Configure to point at Floci (not real AWS) and your local ArangoDB
fix config set fixworker.collector.aws.endpoint <floci-endpoint>
fix config set fixworker.graph_db.server http://localhost:8529
fix config set fixworker.graph_db.database fix

# Run discovery
fix collect
```

After collection, verify resources exist:
- Open http://localhost:8529
- Login: root / cloudmind
- Navigate to Database: fix → Collection: node
- You should see aws_ec2_instance, aws_s3_bucket, aws_vpc, etc.

---

## Step 4 — Configure the Agent Backend

```bash
cd cloudmind/agent
cp .env.example .env
```

Edit `.env`:
```
GEMINI_API_KEY=your_gemini_api_key
ARANGO_HOST=http://localhost:8529
ARANGO_DB=fix
ARANGO_USERNAME=root
ARANGO_PASSWORD=cloudmind
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
```

Install and run:
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Verify: http://localhost:8000/health → {"status": "ok"}

---

## Step 5 — Configure the Frontend

```bash
cd cloudmind/web
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # From Clerk dashboard
CLERK_SECRET_KEY=sk_test_...                    # From Clerk dashboard
AGENT_BASE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Install and run:
```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Step 6 — Run Tests

**Backend (pytest):**
```bash
cd cloudmind/agent
pytest tests/ -v
```

**Frontend unit tests (vitest):**
```bash
cd cloudmind/web
npm test
```

**E2E tests (Playwright):**
```bash
cd cloudmind/web
npx playwright install
npm run test:e2e
```

---

## Deploying to Production

### Frontend → Vercel

1. Push `cloudmind/web/` to a GitHub repo
2. Import into Vercel
3. Set environment variables:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `AGENT_BASE_URL` → your Railway backend URL

### Backend → Railway

1. Push `cloudmind/agent/` to a GitHub repo
2. Create a new Railway project
3. Connect the repo
4. Set environment variables (same as `.env`)
5. Railway auto-detects `railway.json` and uses `uvicorn main:app`

### Managed ArangoDB

For production, use ArangoDB Cloud (ArangoGraph) or self-host on Railway.
Update `ARANGO_HOST`, `ARANGO_DB`, `ARANGO_USERNAME`, `ARANGO_PASSWORD` accordingly.
