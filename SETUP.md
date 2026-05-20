# CloudMind — Local Setup Guide

## Architecture

```
Floci (local AWS simulator :4566)
  └─ seed_floci.py    → creates EC2, S3, VPC, RDS, Lambda, IAM inside Floci

FixInventory (https://fixinventory.org/)
  └─ fixworker        → scans Floci via boto3 (AWS_ENDPOINT_URL=http://floci:4566)
                         no real AWS credentials needed
  └─ fixcore          → receives discovered resources, persists to ArangoDB
                         schema: db=fix, graph=fix, vertices=fix, edges=fix_default

ArangoDB (:8529)
  └─ uvicorn main:app → AI agent queries graph with AQL, streams answers via Gemini

Redis (:6379)
  └─ multi-turn session context (up to 10 turns, 24 h TTL)
```

## Prerequisites

- Docker + Docker Compose
- Python 3.12
- Node.js 20+
- A Gemini API key (https://ai.google.dev/)

---

## Step 1 — Start all infrastructure services

```bash
cd cloudmind/agent
docker compose up -d
```

This starts **five** containers:

| Service    | Port | Purpose |
|------------|------|---------|
| ArangoDB   | 8529 | Graph database — stores the FixInventory resource graph |
| Redis      | 6379 | Session context cache for multi-turn conversations |
| Floci      | 4566 | Local AWS simulator (47 services, no real AWS needed) |
| fixcore    | 8900 | FixInventory core — graph API + collection orchestrator |
| fixworker  | —    | FixInventory worker — discovers resources from Floci |

**Startup sequence** (automatic via `depends_on`):
1. ArangoDB starts → health check passes (~30 s)
2. Floci starts → health check passes (~15 s)
3. fixcore starts after ArangoDB is healthy (~60 s startup)
4. fixworker starts after fixcore is healthy and Floci is healthy

Wait for Floci to be ready before seeding:
```bash
curl http://localhost:4566/_floci/health
# → {"status":"running"}
```

---

## Step 2 — Seed Floci with AWS resources

Floci starts empty. This script creates a realistic AWS environment inside it:

```bash
cd cloudmind/agent
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

python scripts/seed_floci.py
```

Resources created inside Floci:
- 1 VPC + 4 subnets (2 public, 2 private)
- 2 security groups (web-tier ports 80/443, db-tier port 5432)
- 4 EC2 instances (web-server-01, api-server-01, worker-node-1/2)
- 3 S3 buckets (one public, two private + versioned)
- 3 IAM roles (ec2-ssm-role, lambda-basic-role, rds-monitoring-role)
- 1 RDS PostgreSQL instance (encrypted, not publicly accessible)
- 3 Lambda functions (python3.12 + nodejs20.x)
- 1 Application Load Balancer

**Why we seed before fixworker collects:** fixworker starts collecting as soon as it connects to fixcore (`start_collect_on_subscriber_connect=true`). Since fixcore takes ~60-90 s to become healthy and fixworker waits for that, seeding completes well before the first collection run starts.

---

## Step 3 — FixInventory discovers and persists the graph

No manual step needed — this happens automatically.

Once fixworker connects to fixcore, it:
1. Calls `sts:GetCallerIdentity` against Floci to discover the account ID
2. Iterates over AWS services (EC2, VPC, S3, IAM, RDS, Lambda, ELB) against `http://floci:4566`
3. Sends every resource to fixcore, which writes them to ArangoDB

**FixInventory ArangoDB schema:**
- **Database**: `fix`
- **Graph**: `fix`
- **Vertex collection**: `fix` — one document per AWS resource
- **Edge collection**: `fix_default` — directed edges (parent → child)

Each node document:
```json
{
  "_key": "i-0abc123",
  "id":   "i-0abc123",
  "kinds": ["aws_ec2_instance", "aws_resource", "resource"],
  "reported": {
    "kind":            "aws_ec2_instance",
    "id":              "i-0abc123",
    "name":            "web-server-01",
    "region":          "us-east-1",
    "instance_type":   "t3.medium",
    "instance_status": "running"
  },
  "ancestors": {
    "cloud":   { "reported": { "name": "aws" } },
    "account": { "reported": { "id": "000000000000" } },
    "region":  { "reported": { "name": "us-east-1" } }
  }
}
```

**Verify the graph** in ArangoDB UI at http://localhost:8529 (root / cloudmind):
- Database `fix` → Collection `fix` → 20+ resource documents
- Database `fix` → Collection `fix_default` → edges between resources

**Monitor fixworker logs:**
```bash
docker logs fixworker -f
```

**Re-trigger collection** (e.g. after adding more resources to Floci):
```bash
docker compose restart fixworker
```

---

## Step 4 — Configure the Agent Backend

```bash
cp agent/.env.example agent/.env
```

Edit `agent/.env`:
```
GEMINI_API_KEY=your-key-here
ARANGO_HOST=http://localhost:8529
ARANGO_PASSWORD=cloudmind
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
# FixInventory schema defaults — no change needed for local dev:
# ARANGO_DB=fix
# ARANGO_VERTEX_COLLECTION=fix
# ARANGO_EDGE_COLLECTION=fix_default
```

---

## Step 5 — Start the Backend

```bash
cd cloudmind/agent
source venv/bin/activate
uvicorn main:app --reload
```

Test it:
```bash
curl http://localhost:8000/health
# → {"status":"ok"}

curl http://localhost:8000/agent/chat \
  -X POST -H "Content-Type: application/json" \
  -d '{"message":"How many EC2 instances do I have?","session_id":"test"}'
# → "You have 4 EC2 instances in us-east-1..."
```

---

## Step 6 — Start the Frontend

```bash
cd cloudmind/web
cp .env.example .env.local
# Set AGENT_BASE_URL=http://localhost:8000 in .env.local
npm install
npm run dev
```

Open http://localhost:3000

---

## How FixInventory connects to Floci (not real AWS)

fixworker's container receives `AWS_ENDPOINT_URL=http://floci:4566`. This is a standard
botocore environment variable (supported since botocore 1.27) that redirects **all** boto3
service calls to the specified endpoint. Combined with fake credentials (`test`/`test`),
this means:

- fixworker **never contacts real AWS**
- Every API call hits Floci's local simulator instead
- Discovered resources are exactly what `seed_floci.py` created

The PSK (`cloudmind-fixpsk`) is a shared secret between fixcore and fixworker used for
mutual authentication over the HTTPS channel.

---

## Re-triggering Discovery

After modifying resources in Floci, restart fixworker to re-collect:

```bash
python scripts/seed_floci.py        # update resources in Floci
docker compose restart fixworker    # fixworker re-collects on startup
```

---

## Fallback: manual discovery script

If FixInventory containers are unavailable, `scripts/discover.py` can populate
ArangoDB directly (writes the same FixInventory-compatible schema):

```bash
python scripts/discover.py
```

This is a development fallback only — in normal operation, fixworker handles all discovery.

---

## Options

```bash
# Different region:
python scripts/seed_floci.py --region eu-west-1

# Remote ArangoDB (e.g. ArangoCloud) for the agent backend:
# Set in agent/.env:
# ARANGO_HOST=https://your-cluster.arangodb.cloud:8529
# ARANGO_PASSWORD=yourpassword
```
