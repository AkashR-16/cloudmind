#!/usr/bin/env python3
"""
FixInventory-compatible discovery pipeline for CloudMind.

Flow:
  Floci (local AWS simulator on :4566)
    └─ boto3 discovers EC2, VPC, S3, IAM, RDS, Lambda, ELB
        └─ writes to ArangoDB using FixInventory's exact schema:
             database:    fix
             graph:       fix
             vertices:    fix  (one doc per AWS resource)
             edges:       fix_default  (parent→child relationships)

This replicates what `fixworker` does when pointed at a real AWS account,
but directed at Floci so no real AWS credentials are needed.

Usage:
  python discover.py
  python discover.py --endpoint http://localhost:4566 \\
                     --arango-host http://localhost:8529 \\
                     --arango-password cloudmind
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from arango import ArangoClient

# FixInventory ArangoDB defaults
ARANGO_DB       = "fix"
GRAPH_NAME      = "fix"
VERTEX_COL      = "fix"
EDGE_COL        = "fix_default"
ACCOUNT_ID      = "000000000000"   # Floci fake account
CLOUD_ID        = "aws"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _key(resource_id: str) -> str:
    """ArangoDB keys cannot contain slashes or colons."""
    return resource_id.replace("/", "_").replace(":", "_").replace(" ", "_")


def _hash(reported: dict) -> str:
    raw = json.dumps(reported, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def make_node(
    resource_id: str,
    kind: str,
    reported_extra: dict,
    region: str,
    parent_kinds: list[str] | None = None,
) -> dict:
    """Build a FixInventory-compatible vertex document."""
    reported = {
        "kind": kind,
        "id": resource_id,
        "region": region,
        "account_id": ACCOUNT_ID,
        **reported_extra,
    }
    kinds = [kind] + (parent_kinds or ["aws_resource", "resource"])
    return {
        "_key":    _key(resource_id),
        "id":      resource_id,
        "kinds":   kinds,
        "reported": reported,
        "metadata": {},
        "ancestors": {
            "cloud":   {"reported": {"id": CLOUD_ID,   "name": CLOUD_ID,   "kind": "cloud"}},
            "account": {"reported": {"id": ACCOUNT_ID, "name": "floci-account", "kind": "aws_account"}},
            "region":  {"reported": {"id": region,     "name": region,     "kind": "aws_region"}},
        },
        "hash":    _hash(reported),
        "created": _now(),
        "updated": _now(),
    }


def make_edge(from_id: str, to_id: str) -> dict:
    """Build a FixInventory-compatible edge document."""
    fk, tk = _key(from_id), _key(to_id)
    return {
        "_key":  f"{fk}__{tk}",
        "_from": f"{VERTEX_COL}/{fk}",
        "_to":   f"{VERTEX_COL}/{tk}",
        "label": "default",
    }


def boto3_client(service: str, endpoint: str, region: str):
    return boto3.client(
        service,
        region_name=region,
        endpoint_url=endpoint,
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


# ── Per-service discoverers ───────────────────────────────────────────────────

def discover_ec2(client, region: str):
    nodes, edges = [], []

    # VPCs
    for vpc in client.describe_vpcs().get("Vpcs", []):
        vid = vpc["VpcId"]
        name = next((t["Value"] for t in vpc.get("Tags", []) if t["Key"] == "Name"), vid)
        nodes.append(make_node(vid, "aws_vpc", {
            "name": name,
            "cidr_block": vpc.get("CidrBlock"),
            "is_default": vpc.get("IsDefault", False),
        }, region))

    # Subnets
    for sn in client.describe_subnets().get("Subnets", []):
        sid, vid = sn["SubnetId"], sn["VpcId"]
        name = next((t["Value"] for t in sn.get("Tags", []) if t["Key"] == "Name"), sid)
        nodes.append(make_node(sid, "aws_subnet", {
            "name": name,
            "vpc_id": vid,
            "cidr_block": sn.get("CidrBlock"),
            "availability_zone": sn.get("AvailabilityZone"),
            "available_ip_address_count": sn.get("AvailableIpAddressCount"),
        }, region))
        if vid:
            edges.append(make_edge(vid, sid))

    # Security Groups
    for sg in client.describe_security_groups().get("SecurityGroups", []):
        sgid, vid = sg["GroupId"], sg.get("VpcId")
        nodes.append(make_node(sgid, "aws_security_group", {
            "name": sg.get("GroupName"),
            "group_name": sg.get("GroupName"),
            "description": sg.get("Description"),
            "vpc_id": vid,
            "ip_permissions": sg.get("IpPermissions", []),
            "ip_permissions_egress": sg.get("IpPermissionsEgress", []),
        }, region))
        if vid:
            edges.append(make_edge(vid, sgid))

    # EC2 Instances
    for res in client.describe_instances().get("Reservations", []):
        for inst in res.get("Instances", []):
            iid = inst["InstanceId"]
            name = next((t["Value"] for t in inst.get("Tags", []) if t["Key"] == "Name"), iid)
            subnet_id = inst.get("SubnetId")
            nodes.append(make_node(iid, "aws_ec2_instance", {
                "name": name,
                "instance_type": inst.get("InstanceType"),
                "instance_status": inst.get("State", {}).get("Name", "unknown"),
                "public_ip_address": inst.get("PublicIpAddress"),
                "private_ip_address": inst.get("PrivateIpAddress"),
                "subnet_id": subnet_id,
                "vpc_id": inst.get("VpcId"),
                "image_id": inst.get("ImageId"),
                "tags": {t["Key"]: t["Value"] for t in inst.get("Tags", [])},
            }, region))
            if subnet_id:
                edges.append(make_edge(subnet_id, iid))

    return nodes, edges


def discover_s3(client, region: str):
    nodes = []
    for b in client.list_buckets().get("Buckets", []):
        name = b["Name"]
        bucket_id = f"arn:aws:s3:::{name}"

        try:
            pab = client.get_public_access_block(Bucket=name)
            cfg = pab.get("PublicAccessBlockConfiguration", {})
            is_public = not all([
                cfg.get("BlockPublicAcls", False),
                cfg.get("IgnorePublicAcls", False),
                cfg.get("BlockPublicPolicy", False),
                cfg.get("RestrictPublicBuckets", False),
            ])
        except ClientError:
            is_public = True  # No block config = potentially public

        try:
            vers = client.get_bucket_versioning(Bucket=name)
            versioning_enabled = vers.get("Status") == "Enabled"
        except ClientError:
            versioning_enabled = False

        nodes.append(make_node(bucket_id, "aws_s3_bucket", {
            "name": name,
            "is_public": is_public,
            "versioning_enabled": versioning_enabled,
        }, region))

    return nodes, []


def discover_iam(client, region: str):
    nodes = []
    for role in client.list_roles().get("Roles", []):
        arn = role["Arn"]
        policy = role.get("AssumeRolePolicyDocument", {})
        principals = []
        for stmt in policy.get("Statement", []):
            p = stmt.get("Principal", {})
            for v in (p.values() if isinstance(p, dict) else [p]):
                principals.extend(v if isinstance(v, list) else [v])
        nodes.append(make_node(arn, "aws_iam_role", {
            "name": role.get("RoleName"),
            "arn": arn,
            "assume_role_policy": principals[0] if principals else None,
            "create_date": str(role.get("CreateDate", "")),
        }, "global"))  # IAM is global
    return nodes, []


def discover_rds(client, region: str):
    nodes, edges = [], []
    for db in client.describe_db_instances().get("DBInstances", []):
        db_id = db.get("DBInstanceIdentifier", "")
        arn = db.get("DBInstanceArn", db_id)
        vpc_id = db.get("DBSubnetGroup", {}).get("VpcId")
        nodes.append(make_node(arn, "aws_rds_instance", {
            "name": db_id,
            "engine": db.get("Engine"),
            "engine_version": db.get("EngineVersion"),
            "instance_class": db.get("DBInstanceClass"),
            "storage_encrypted": db.get("StorageEncrypted", False),
            "publicly_accessible": db.get("PubliclyAccessible", False),
            "db_instance_status": db.get("DBInstanceStatus"),
            "allocated_storage": db.get("AllocatedStorage"),
            "vpc_id": vpc_id,
        }, region))
        if vpc_id:
            edges.append(make_edge(vpc_id, arn))
    return nodes, edges


def discover_lambda(client, region: str):
    nodes = []
    paginator = client.get_paginator("list_functions")
    for page in paginator.paginate():
        for fn in page.get("Functions", []):
            arn = fn.get("FunctionArn", fn.get("FunctionName", ""))
            nodes.append(make_node(arn, "aws_lambda_function", {
                "name": fn.get("FunctionName"),
                "runtime": fn.get("Runtime"),
                "memory_size": fn.get("MemorySize"),
                "timeout": fn.get("Timeout"),
                "handler": fn.get("Handler"),
                "role": fn.get("Role"),
                "last_modified": fn.get("LastModified"),
            }, region))
    return nodes, []


def discover_elb(client, region: str):
    nodes, edges = [], []
    for lb in client.describe_load_balancers().get("LoadBalancers", []):
        arn = lb.get("LoadBalancerArn", "")
        vpc_id = lb.get("VpcId")
        nodes.append(make_node(arn, "aws_alb", {
            "name": lb.get("LoadBalancerName"),
            "scheme": lb.get("Scheme"),
            "type": lb.get("Type"),
            "dns_name": lb.get("DNSName"),
            "state": lb.get("State", {}).get("Code"),
            "vpc_id": vpc_id,
        }, region))
        if vpc_id:
            edges.append(make_edge(vpc_id, arn))
    return nodes, edges


# ── ArangoDB writer ───────────────────────────────────────────────────────────

def write_to_arango(
    arango_host: str,
    arango_password: str,
    nodes: list[dict],
    edges: list[dict],
) -> None:
    client = ArangoClient(hosts=arango_host)
    sys_db = client.db("_system", username="root", password=arango_password)

    if not sys_db.has_database(ARANGO_DB):
        sys_db.create_database(ARANGO_DB)
        print(f"  Created database '{ARANGO_DB}'")

    db = client.db(ARANGO_DB, username="root", password=arango_password)

    if not db.has_collection(VERTEX_COL):
        db.create_collection(VERTEX_COL)
    if not db.has_collection(EDGE_COL):
        db.create_collection(EDGE_COL, edge=True)

    if not db.has_graph(GRAPH_NAME):
        db.create_graph(GRAPH_NAME, edge_definitions=[{
            "edge_collection": EDGE_COL,
            "from_vertex_collections": [VERTEX_COL],
            "to_vertex_collections": [VERTEX_COL],
        }])
        print(f"  Created graph '{GRAPH_NAME}'")

    vcol = db.collection(VERTEX_COL)
    ecol = db.collection(EDGE_COL)

    n_ok = sum(1 for n in nodes if vcol.insert(n, overwrite=True, silent=True) is not False)
    e_ok = 0
    for e in edges:
        try:
            ecol.insert(e, overwrite=True, silent=True)
            e_ok += 1
        except Exception:
            pass

    print(f"  ✓ {n_ok} nodes → {ARANGO_DB}/{VERTEX_COL}")
    print(f"  ✓ {e_ok} edges → {ARANGO_DB}/{EDGE_COL}")


# ── Main ──────────────────────────────────────────────────────────────────────

DISCOVERERS = [
    ("EC2 / VPC / Subnets / Security Groups", "ec2",    discover_ec2),
    ("S3 Buckets",                            "s3",     discover_s3),
    ("IAM Roles",                             "iam",    discover_iam),
    ("RDS Instances",                         "rds",    discover_rds),
    ("Lambda Functions",                      "lambda", discover_lambda),
    ("Load Balancers",                        "elbv2",  discover_elb),
]


def main():
    parser = argparse.ArgumentParser(
        description="Discover AWS resources from Floci and write to ArangoDB (FixInventory schema)"
    )
    parser.add_argument("--endpoint",        default="http://localhost:4566", help="Floci endpoint")
    parser.add_argument("--region",          default="us-east-1",            help="AWS region")
    parser.add_argument("--arango-host",     default="http://localhost:8529", help="ArangoDB host")
    parser.add_argument("--arango-password", default="cloudmind",            help="ArangoDB root password")
    args = parser.parse_args()

    print(f"Discovering resources from {args.endpoint} ({args.region})...\n")

    all_nodes: list[dict] = []
    all_edges: list[dict] = []

    for label, service, fn in DISCOVERERS:
        try:
            c = boto3_client(service, args.endpoint, args.region)
            nodes, edges = fn(c, args.region)
            all_nodes.extend(nodes)
            all_edges.extend(edges)
            print(f"  [{label}] {len(nodes)} resources, {len(edges)} edges")
        except Exception as exc:
            print(f"  [{label}] SKIPPED — {exc}")

    print(f"\nTotal: {len(all_nodes)} resources, {len(all_edges)} edges")
    print(f"\nWriting to ArangoDB at {args.arango_host}...")
    write_to_arango(args.arango_host, args.arango_password, all_nodes, all_edges)

    print("\n✓ Discovery complete. ArangoDB now contains FixInventory-format graph.")
    print(f"  Database: {ARANGO_DB}   Graph: {GRAPH_NAME}")
    print(f"  Vertices: {VERTEX_COL}  Edges: {EDGE_COL}")


if __name__ == "__main__":
    main()
