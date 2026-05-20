import re
from core.gemini_client import get_aql_model
from core.models import Intent, IntentType
from core.config import get_settings

# FixInventory ArangoDB schema reference:
# - Vertex collection: "node"  (all resource kinds stored here)
# - Edge collection:   "default" (relationships between resources)
# - Key fields: kind (resource type), reported.name, reported.region,
#               reported.id, reported.tags, reported.account_id
def _kind_field(vertex_col: str) -> str:
    """Return the AQL field path for resource kind depending on schema version."""
    # Legacy schema (vertex_col="node"): kind is at top level n.kind
    # FixInventory schema (vertex_col="fix" or others): kind is at n.reported.kind
    return "kind" if vertex_col == "node" else "reported.kind"


def _build_schema_context(vertex_col: str, edge_col: str) -> str:
    kind_field = _kind_field(vertex_col)
    return f"""
FixInventory ArangoDB schema (populated from Floci local AWS simulator):
- Vertex collection: "{vertex_col}"
- Edge collection: "{edge_col}"
- Each node document has:
    _key: string (ArangoDB document key, equals the AWS resource ID)
    {kind_field}: string — exact resource type (e.g. "aws_ec2_instance", "aws_s3_bucket", "aws_vpc",
                   "aws_subnet", "aws_security_group", "aws_iam_role",
                   "aws_rds_instance", "aws_lambda_function", "aws_elb")
    reported.id: string — AWS resource ID (e.g. "i-0abc123", "vpc-0abc123")
    reported.name: string — human-readable name
    reported.region: string — AWS region (e.g. "us-east-1") or "global" for IAM
    reported.account_id: string — AWS account ID
    reported.tags: object — key/value AWS tags
    reported.instance_type: string — EC2 only (e.g. "t3.medium")
    reported.instance_status: string — EC2 only ("running" | "stopped" | "terminated")
    reported.public_ip_address: string — EC2 public IP (if assigned)
    reported.private_ip_address: string — EC2 private IP
    reported.is_public: bool — S3 bucket: true if public access block is disabled
    reported.versioning_enabled: bool — S3 bucket versioning
    reported.storage_encrypted: bool — RDS instance encryption
    reported.publicly_accessible: bool — RDS instance public access
    reported.engine: string — RDS engine (e.g. "postgres", "mysql")
    reported.instance_class: string — RDS instance class (e.g. "db.t3.micro")
    reported.runtime: string — Lambda runtime (e.g. "python3.12")
    reported.memory_size: int — Lambda memory in MB
    reported.group_name: string — security group name
    reported.ip_permissions: array — security group inbound rules
    reported.cidr_block: string — VPC or subnet CIDR block
    reported.assume_role_policy: string — IAM role trust principal (e.g. "ec2.amazonaws.com")
"""

def _build_aql_prompt(vertex_col: str, edge_col: str, schema: str, limit: int,
                      question: str, intent: str, entities: object) -> str:
    """Build the final AQL generation prompt without multi-stage format() calls."""
    kf = _kind_field(vertex_col)  # "kind" or "reported.kind" depending on schema
    return (
        f"You are an ArangoDB AQL query generator for AWS infrastructure discovered by FixInventory.\n\n"
        f"{schema}\n"
        f"Generate a single AQL query for the question below. Rules:\n"
        f"1. For list/filter queries:\n"
        f"   FOR n IN {vertex_col} FILTER n.{kf} == \"aws_xyz\" LIMIT {limit} RETURN {{...}}\n"
        f"   - Filter by n.{kf} (exact string match)\n"
        f"   - ALWAYS place LIMIT {limit} BEFORE the RETURN clause\n"
        f"2. For COUNT queries:\n"
        f"   RETURN LENGTH(FOR n IN {vertex_col} FILTER n.{kf} == \"aws_xyz\" RETURN 1)\n"
        f"   - Use LENGTH(subquery) — never COUNT(n) in a FOR loop\n"
        f"   - Do NOT add outer LIMIT to count queries\n"
        f"3. For topology queries (what is connected to X):\n"
        f"   FOR v, e IN 1..1 OUTBOUND (FOR x IN {vertex_col} FILTER x.{kf} == \"aws_vpc\" LIMIT 1 RETURN x)[0] {edge_col}\n"
        f"     RETURN {{kind: v.{kf}, name: v.reported.name}}\n"
        f"4. Return only fields needed. Output ONLY the AQL — no markdown, no explanation.\n"
        f"5. CRITICAL — nested array filtering: ArangoDB does NOT support `array ANY == value` on arrays of objects.\n"
        f"   For ip_permissions (array of objects each with IpRanges array), you MUST use nested FOR loops:\n"
        f"   LENGTH(FOR perm IN n.reported.ip_permissions FOR cidr IN perm.IpRanges FILTER cidr.CidrIp == \"0.0.0.0/0\" RETURN 1) > 0\n"
        f"   Never write: ip_permissions ANY == ... or IpRanges ANY == ...\n\n"
        f"Examples:\n"
        f"- \"How many EC2 instances?\" ->\n"
        f"  RETURN LENGTH(FOR n IN {vertex_col} FILTER n.{kf} == \"aws_ec2_instance\" RETURN 1)\n"
        f"- \"List running EC2 instances\" ->\n"
        f"  FOR n IN {vertex_col} FILTER n.{kf} == \"aws_ec2_instance\" AND n.reported.instance_status == \"running\" LIMIT {limit} RETURN {{id: n.reported.id, name: n.reported.name, type: n.reported.instance_type, region: n.reported.region}}\n"
        f"- \"Which S3 buckets are public?\" ->\n"
        f"  FOR n IN {vertex_col} FILTER n.{kf} == \"aws_s3_bucket\" AND n.reported.is_public == true LIMIT {limit} RETURN {{name: n.reported.name, region: n.reported.region}}\n"
        f"- \"List IAM roles\" ->\n"
        f"  FOR n IN {vertex_col} FILTER n.{kf} == \"aws_iam_role\" LIMIT {limit} RETURN {{name: n.reported.name, principal: n.reported.assume_role_policy}}\n"
        f"- \"Which security groups allow inbound 0.0.0.0/0?\" ->\n"
        f"  FOR n IN {vertex_col} FILTER n.{kf} == \"aws_security_group\"\n"
        f"  AND LENGTH(FOR perm IN n.reported.ip_permissions FOR cidr IN perm.IpRanges FILTER cidr.CidrIp == \"0.0.0.0/0\" RETURN 1) > 0\n"
        f"  LIMIT {limit} RETURN {{name: n.reported.name, id: n.reported.id, region: n.reported.region, ports: n.reported.ip_permissions}}\n"
        f"- \"Which security groups allow port 22?\" ->\n"
        f"  FOR n IN {vertex_col} FILTER n.{kf} == \"aws_security_group\"\n"
        f"  AND LENGTH(FOR perm IN n.reported.ip_permissions FILTER perm.FromPort <= 22 AND perm.ToPort >= 22 RETURN 1) > 0\n"
        f"  LIMIT {limit} RETURN {{name: n.reported.name, id: n.reported.id, region: n.reported.region}}\n\n"
        f"Question: {question}\n"
        f"Intent: {intent}\n"
        f"Entities: {entities}\n"
    )


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

    vertex_col = settings.arango_vertex_collection
    edge_col = settings.arango_edge_collection

    schema_ctx = _build_schema_context(vertex_col, edge_col)
    prompt = _build_aql_prompt(
        vertex_col=vertex_col,
        edge_col=edge_col,
        schema=schema_ctx,
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
