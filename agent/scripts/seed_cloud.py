#!/usr/bin/env python3
"""
Seed a remote ArangoDB instance with CloudMind demo data.

Usage:
  python seed_cloud.py \
    --host https://your-cluster.arangodb.cloud:8529 \
    --db fixinventory \
    --username root \
    --password YOUR_PASSWORD
"""
import argparse
from arango import ArangoClient

NODES = [
    {"_key": "vpc-001", "kind": "aws_vpc", "reported": {"id": "vpc-001", "name": "main-vpc", "region": "us-east-1", "cidr_block": "10.0.0.0/16"}},
    {"_key": "subnet-001", "kind": "aws_subnet", "reported": {"id": "subnet-001", "name": "public-subnet-1", "region": "us-east-1", "availability_zone": "us-east-1a", "cidr_block": "10.0.1.0/24"}},
    {"_key": "subnet-002", "kind": "aws_subnet", "reported": {"id": "subnet-002", "name": "private-subnet-1", "region": "us-east-1", "availability_zone": "us-east-1b", "cidr_block": "10.0.2.0/24"}},
    {"_key": "sg-001", "kind": "aws_security_group", "reported": {"id": "sg-001", "name": "web-tier-sg", "region": "us-east-1", "description": "Web tier security group", "ingress_rules": [{"port": 443, "cidr": "0.0.0.0/0"}, {"port": 80, "cidr": "0.0.0.0/0"}]}},
    {"_key": "sg-002", "kind": "aws_security_group", "reported": {"id": "sg-002", "name": "db-tier-sg", "region": "us-east-1", "description": "Database tier SG", "ingress_rules": [{"port": 5432, "cidr": "10.0.0.0/16"}]}},
    {"_key": "i-001", "kind": "aws_ec2_instance", "reported": {"id": "i-001", "name": "web-server-01", "region": "us-east-1", "instance_type": "t3.medium", "instance_status": "running", "public_ip": "54.210.12.34", "private_ip": "10.0.1.10"}},
    {"_key": "i-002", "kind": "aws_ec2_instance", "reported": {"id": "i-002", "name": "api-server-01", "region": "us-east-1", "instance_type": "t3.large", "instance_status": "running", "public_ip": "52.90.45.67", "private_ip": "10.0.1.20"}},
    {"_key": "i-003", "kind": "aws_ec2_instance", "reported": {"id": "i-003", "name": "worker-node-1", "region": "us-east-1", "instance_type": "t3.small", "instance_status": "running", "private_ip": "10.0.2.10"}},
    {"_key": "bucket-001", "kind": "aws_s3_bucket", "reported": {"id": "bucket-001", "name": "my-app-assets", "region": "us-east-1", "public_access_block": False, "versioning": False}},
    {"_key": "bucket-002", "kind": "aws_s3_bucket", "reported": {"id": "bucket-002", "name": "my-app-backups", "region": "us-east-1", "public_access_block": True, "versioning": True}},
    {"_key": "role-001", "kind": "aws_iam_role", "reported": {"id": "role-001", "name": "ec2-ssm-role", "region": "global", "assume_role_policy": "ec2.amazonaws.com"}},
    {"_key": "role-002", "kind": "aws_iam_role", "reported": {"id": "role-002", "name": "lambda-basic-role", "region": "global", "assume_role_policy": "lambda.amazonaws.com"}},
    {"_key": "rds-001", "kind": "aws_rds_instance", "reported": {"id": "rds-001", "name": "main-postgres", "region": "us-east-1", "engine": "postgres", "engine_version": "15.4", "instance_class": "db.t3.micro", "storage_encrypted": True, "publicly_accessible": False}},
    {"_key": "lambda-001", "kind": "aws_lambda_function", "reported": {"id": "lambda-001", "name": "image-processor", "region": "us-east-1", "runtime": "python3.12", "memory_size": 512, "timeout": 30}},
    {"_key": "elb-001", "kind": "aws_elb", "reported": {"id": "elb-001", "name": "web-alb", "region": "us-east-1", "scheme": "internet-facing", "type": "application"}},
    {"_key": "r53-001", "kind": "aws_route53_zone", "reported": {"id": "r53-001", "name": "app.internal", "region": "global", "private_zone": True}},
]

EDGES = [
    {"_from": "node/vpc-001",    "_to": "node/subnet-001",  "label": "contains"},
    {"_from": "node/vpc-001",    "_to": "node/subnet-002",  "label": "contains"},
    {"_from": "node/subnet-001", "_to": "node/i-001",       "label": "hosts"},
    {"_from": "node/subnet-001", "_to": "node/i-002",       "label": "hosts"},
    {"_from": "node/subnet-002", "_to": "node/i-003",       "label": "hosts"},
    {"_from": "node/sg-001",     "_to": "node/i-001",       "label": "protects"},
    {"_from": "node/sg-001",     "_to": "node/i-002",       "label": "protects"},
    {"_from": "node/sg-002",     "_to": "node/rds-001",     "label": "protects"},
    {"_from": "node/role-001",   "_to": "node/i-001",       "label": "attached_to"},
    {"_from": "node/elb-001",    "_to": "node/i-001",       "label": "routes_to"},
]


def main():
    parser = argparse.ArgumentParser(description="Seed CloudMind demo data into ArangoDB")
    parser.add_argument("--host",     default="http://localhost:8529")
    parser.add_argument("--db",       default="fixinventory")
    parser.add_argument("--username", default="root")
    parser.add_argument("--password", default="")
    args = parser.parse_args()

    print(f"Connecting to {args.host} ...")
    client = ArangoClient(hosts=args.host)
    sys_db = client.db("_system", username=args.username, password=args.password)

    if not sys_db.has_database(args.db):
        sys_db.create_database(args.db)
        print(f"Created database: {args.db}")

    db = client.db(args.db, username=args.username, password=args.password)

    if not db.has_collection("node"):
        db.create_collection("node")
    if not db.has_collection("default"):
        db.create_collection("default", edge=True)

    node_col = db.collection("node")
    edge_col = db.collection("default")

    node_col.truncate()
    edge_col.truncate()

    node_col.insert_many(NODES, overwrite=True)
    edge_col.insert_many(EDGES, overwrite=True)

    print(f"Seeded {len(NODES)} nodes and {len(EDGES)} edges.")
    print("Done.")


if __name__ == "__main__":
    main()
