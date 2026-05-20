# CloudMind — Local Setup Guide

## Architecture

```
Floci (local AWS simulator on :4566)
  └─ seed_floci.py  → creates EC2, S3, VPC, RDS, Lambda, IAM inside Floci
  └─ discover.py    → reads from Floci via boto3, writes to ArangoDB
                       using FixInventory's exact schema (db=fix, graph=fix)
ArangoDB (local :8529)
  └─ uvicorn main:app  → AI agent queries graph, answers questions
Redis (local :6379)
  └─ multi-turn session context
```

## Prerequisites

- Docker + Docker Compose
- Python 3.12
- Node.js 20+
- A Gemini API key (https://ai.google.dev/)

---

## Step 1 — Start ArangoDB, Redis, and Floci

```bash
cd cloudmind/agent
docker compose up -d
```

This starts three containers:

| Service  | Port | Purpose |
|----------|------|---------|
| ArangoDB | 8529 | Graph database (FixInventory schema) |
| Redis    | 6379 | Session context cache |
| Floci    | 4566 | Local AWS environment simulator (47 services) |

Wait ~15 seconds for Floci to finish initialising, then verify:
```bash
curl http://localhost:4566/_floci/health
```

---

## Step 2 — Seed Floci with AWS resources

Floci starts empty. This script creates a realistic AWS environment inside it:

```bash
cd cloudmind/agent
source venv/bin/activate   # or: python -m venv venv && pip install -r requirements.txt
pip install boto3           # needed for discovery scripts

python scripts/seed_floci.py
```

Resources created inside Floci:
- 1 VPC + 4 subnets (2 public, 2 private)
- 2 security groups (web-tier port 443/80, db-tier port 5432)
- 4 EC2 instances (web-server-01, api-server-01, worker-node-1/2)
- 3 S3 buckets (one public, two private+versioned)
- 3 IAM roles (ec2-ssm-role, lambda-basic-role, rds-monitoring-role)
- 1 RDS PostgreSQL instance (encrypted, not publicly accessible)
- 3 Lambda functions (python3.12 + nodejs20.x)
- 1 Application Load Balancer

---

## Step 3 — Run Discovery (Floci → ArangoDB)

This is the FixInventory-equivalent step: reads every AWS service from Floci
via boto3 and writes the resource graph to ArangoDB in FixInventory's exact schema.

```bash
python scripts/discover.py
```

FixInventory schema written to ArangoDB:
- **Database**: `fix`
- **Graph**: `fix`
- **Vertex collection**: `fix`  (one document per AWS resource)
- **Edge collection**: `fix_default`  (parent → child relationships)

Each node document matches FixInventory's format exactly:
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

Verify in ArangoDB UI at http://localhost:8529 (root / cloudmind):
- Database `fix` → Collection `fix` → 20+ resource documents
- Database `fix` → Collection `fix_default` → edges between resources

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
# FixInventory schema defaults — no need to change for local dev:
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
# → "You have 4 running EC2 instances..."
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

## Re-running Discovery

After adding more resources to Floci, re-run discovery to update ArangoDB:

```bash
python scripts/discover.py
```

The script upserts — existing resources are updated, new ones are added.

---

## Options

```bash
# Different Floci port or region:
python scripts/seed_floci.py --endpoint http://localhost:4566 --region eu-west-1
python scripts/discover.py   --endpoint http://localhost:4566 --region eu-west-1

# Remote ArangoDB (e.g. ArangoCloud):
python scripts/discover.py \
  --arango-host https://your-cluster.arangodb.cloud:8529 \
  --arango-password yourpassword
```
