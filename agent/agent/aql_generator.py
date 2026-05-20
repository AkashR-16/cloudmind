import re
from core.gemini_client import get_aql_model
from core.models import Intent, IntentType
from core.config import get_settings

# FixInventory ArangoDB schema reference:
# - Vertex collection: "node"  (all resource kinds stored here)
# - Edge collection:   "default" (relationships between resources)
# - Key fields: kind (resource type), reported.name, reported.region,
#               reported.id, reported.tags, reported.account_id
_SCHEMA_CONTEXT = """
FixInventory ArangoDB schema:
- Vertex collection: "node"
- Edge collection: "default"
- Each node has:
    kind: string (e.g. "aws_ec2_instance", "aws_s3_bucket", "aws_vpc",
          "aws_subnet", "aws_security_group", "aws_iam_role",
          "aws_rds_instance", "aws_lambda_function", "aws_elb")
    reported.name: string
    reported.id: string (AWS resource ID)
    reported.region: string
    reported.account_id: string
    reported.tags: object
    reported.instance_type: string (EC2 only)
    reported.instance_status: string (EC2 only, "running"|"stopped")
    reported.bucket_public_access_block: object (S3 only)
    reported.is_public: bool (S3/security group)
    reported.group_name: string (security groups)
"""

_AQL_PROMPT = """You are an ArangoDB AQL query generator for AWS infrastructure data.

{schema}

Generate a single AQL query for this question. Rules:
1. For list/filter queries: FOR n IN node FILTER ... LIMIT {limit} RETURN {{...}}
   - ALWAYS place LIMIT {limit} BEFORE the RETURN clause — never after it
2. For COUNT queries: RETURN LENGTH(FOR n IN node FILTER ... RETURN 1)
   - Use LENGTH(subquery) for counting — NOT COUNT(n) which is invalid in a FOR loop RETURN
   - Do NOT add LIMIT to count queries — LENGTH() handles the full count
3. Query only the "node" collection for resource lookups
4. Use "default" collection only for relationship/topology queries
5. Return only the fields needed to answer the question
6. Output ONLY the AQL query — no explanation, no markdown fences

Examples:
- "How many EC2 instances are running?" →
  RETURN LENGTH(FOR n IN node FILTER n.kind == "aws_ec2_instance" AND n.reported.instance_status == "running" RETURN 1)

- "List running EC2 instances" →
  FOR n IN node FILTER n.kind == "aws_ec2_instance" AND n.reported.instance_status == "running" LIMIT {limit} RETURN {{id: n.reported.id, name: n.reported.name, region: n.reported.region}}

Question: {question}
Intent: {intent}
Entities: {entities}
"""


_FORBIDDEN_PATTERNS = [
    r"\bREMOVE\b",
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bREPLACE\b",
    r"\bUPSERT\b",
    r"\bFOR\s+\w+\s+IN\s+\w+\s+REMOVE\b",
]


def validate_aql(query: str) -> tuple[bool, str]:
    """Reject any AQL that attempts writes. Returns (is_valid, reason)."""
    upper = query.upper()
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, upper):
            return False, f"Write operation detected: {pattern}"
    # COUNT queries use RETURN LENGTH(...) and don't need an outer LIMIT
    is_count_query = bool(re.search(r"\bRETURN\s+LENGTH\s*\(", upper))
    if "LIMIT" not in upper and not is_count_query:
        return False, "Missing LIMIT clause"
    return True, ""


def fix_limit_position(query: str, limit: int) -> str:
    """Ensure LIMIT appears before RETURN (AQL requires this order).
    Count queries using RETURN LENGTH(...) are left unchanged.
    """
    upper = query.upper()

    # RETURN LENGTH(...) is a self-contained count query — no outer LIMIT needed
    if re.search(r"\bRETURN\s+LENGTH\s*\(", upper):
        return query

    if "LIMIT" not in upper:
        # Insert LIMIT before RETURN
        return re.sub(r'(?i)(RETURN\b)', f'LIMIT {limit}\n  \\1', query, count=1)

    # If LIMIT appears after RETURN, move it before RETURN
    return_pos = upper.rfind("RETURN")
    limit_pos = upper.rfind("LIMIT")
    if limit_pos > return_pos:
        query_no_limit = re.sub(r'(?i)\s*LIMIT\s+\d+\s*$', '', query.rstrip())
        return re.sub(r'(?i)(RETURN\b)', f'LIMIT {limit}\n  \\1', query_no_limit, count=1)

    return query


inject_limit_if_missing = fix_limit_position


async def generate_aql(intent: Intent) -> str:
    settings = get_settings()
    model = get_aql_model()

    if intent.type == IntentType.unknown:
        return ""

    prompt = _AQL_PROMPT.format(
        schema=_SCHEMA_CONTEXT,
        limit=settings.aql_result_limit,
        question=intent.raw_question,
        intent=intent.type.value,
        entities=intent.entities,
    )

    try:
        response = model.generate_content(prompt)
    except Exception as e:
        if "RESOURCE_EXHAUSTED" in str(e) or "quota" in str(e).lower():
            raise RuntimeError("RESOURCE_EXHAUSTED: Gemini quota exceeded")
        raise
    query = response.text.strip()

    # Strip markdown fences
    if query.startswith("```"):
        parts = query.split("```")
        query = parts[1] if len(parts) > 1 else query
        if query.startswith("aql") or query.startswith("sql"):
            query = query[3:]
    query = query.strip()

    # Fix LIMIT position before validation (Gemini sometimes puts LIMIT after RETURN)
    query = fix_limit_position(query, settings.aql_result_limit)

    valid, reason = validate_aql(query)
    if not valid:
        raise ValueError(f"Generated AQL failed validation: {reason}")

    return query
