#!/usr/bin/env python3
"""
Seed Floci (local AWS simulator) with realistic demo infrastructure.

Creates the same resource topology as a small production AWS environment:
VPC → subnets → EC2 instances, security groups, RDS, Lambda, S3, IAM roles.

Usage:
  python seed_floci.py
  python seed_floci.py --endpoint http://localhost:4566 --region us-east-1
"""
import argparse
import io
import json
import zipfile

import boto3
from botocore.exceptions import ClientError

REGION = "us-east-1"


def make_client(service: str, endpoint: str, region: str):
    return boto3.client(
        service,
        region_name=region,
        endpoint_url=endpoint,
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )


def tag(name: str) -> list[dict]:
    return [{"Key": "Name", "Value": name}]


def seed(endpoint: str, region: str) -> None:
    ec2 = make_client("ec2", endpoint, region)
    s3 = make_client("s3", endpoint, region)
    iam = make_client("iam", endpoint, region)
    rds = make_client("rds", endpoint, region)
    lmb = make_client("lambda", endpoint, region)
    elb = make_client("elbv2", endpoint, region)

    # ── VPC ──────────────────────────────────────────────────────────────────
    print("Creating VPC...")
    vpc_id = ec2.create_vpc(CidrBlock="10.0.0.0/16")["Vpc"]["VpcId"]
    ec2.create_tags(Resources=[vpc_id], Tags=tag("main-vpc"))
    ec2.modify_vpc_attribute(VpcId=vpc_id, EnableDnsHostnames={"Value": True})

    igw_id = ec2.create_internet_gateway()["InternetGateway"]["InternetGatewayId"]
    ec2.attach_internet_gateway(InternetGatewayId=igw_id, VpcId=vpc_id)

    # ── Subnets ───────────────────────────────────────────────────────────────
    print("Creating subnets...")
    pub1_id = ec2.create_subnet(
        VpcId=vpc_id, CidrBlock="10.0.1.0/24", AvailabilityZone=f"{region}a"
    )["Subnet"]["SubnetId"]
    ec2.create_tags(Resources=[pub1_id], Tags=tag("public-subnet-1"))

    pub2_id = ec2.create_subnet(
        VpcId=vpc_id, CidrBlock="10.0.2.0/24", AvailabilityZone=f"{region}b"
    )["Subnet"]["SubnetId"]
    ec2.create_tags(Resources=[pub2_id], Tags=tag("public-subnet-2"))

    priv1_id = ec2.create_subnet(
        VpcId=vpc_id, CidrBlock="10.0.3.0/24", AvailabilityZone=f"{region}a"
    )["Subnet"]["SubnetId"]
    ec2.create_tags(Resources=[priv1_id], Tags=tag("private-subnet-1"))

    priv2_id = ec2.create_subnet(
        VpcId=vpc_id, CidrBlock="10.0.4.0/24", AvailabilityZone=f"{region}b"
    )["Subnet"]["SubnetId"]
    ec2.create_tags(Resources=[priv2_id], Tags=tag("private-subnet-2"))

    # ── Security Groups ───────────────────────────────────────────────────────
    print("Creating security groups...")
    web_sg_id = ec2.create_security_group(
        GroupName="web-tier-sg", Description="Web tier — allows 80/443 from internet", VpcId=vpc_id
    )["GroupId"]
    ec2.authorize_security_group_ingress(
        GroupId=web_sg_id,
        IpPermissions=[
            {"IpProtocol": "tcp", "FromPort": 80, "ToPort": 80, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]},
            {"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]},
        ],
    )

    db_sg_id = ec2.create_security_group(
        GroupName="db-tier-sg", Description="Database tier — Postgres from VPC only", VpcId=vpc_id
    )["GroupId"]
    ec2.authorize_security_group_ingress(
        GroupId=db_sg_id,
        IpPermissions=[
            {"IpProtocol": "tcp", "FromPort": 5432, "ToPort": 5432, "IpRanges": [{"CidrIp": "10.0.0.0/16"}]},
        ],
    )

    # ── IAM Roles ─────────────────────────────────────────────────────────────
    print("Creating IAM roles...")
    assume_policy = lambda svc: json.dumps({
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow", "Principal": {"Service": svc}, "Action": "sts:AssumeRole"}],
    })
    try:
        iam.create_role(RoleName="ec2-ssm-role", AssumeRolePolicyDocument=assume_policy("ec2.amazonaws.com"))
    except ClientError:
        pass
    try:
        iam.create_role(RoleName="lambda-basic-role", AssumeRolePolicyDocument=assume_policy("lambda.amazonaws.com"))
    except ClientError:
        pass
    try:
        iam.create_role(RoleName="rds-monitoring-role", AssumeRolePolicyDocument=assume_policy("monitoring.rds.amazonaws.com"))
    except ClientError:
        pass

    # ── EC2 Instances ─────────────────────────────────────────────────────────
    print("Launching EC2 instances...")
    instances = [
        ("web-server-01", "t3.medium", pub1_id, web_sg_id),
        ("api-server-01", "t3.large",  pub1_id, web_sg_id),
        ("worker-node-1", "t3.small",  priv1_id, db_sg_id),
        ("worker-node-2", "t3.small",  priv2_id, db_sg_id),
    ]
    for name, itype, subnet, sg in instances:
        r = ec2.run_instances(
            ImageId="ami-0123456789abcdef0",
            InstanceType=itype,
            MinCount=1, MaxCount=1,
            SubnetId=subnet,
            SecurityGroupIds=[sg],
            TagSpecifications=[{"ResourceType": "instance", "Tags": tag(name)}],
        )
        iid = r["Instances"][0]["InstanceId"]
        print(f"  {name}: {iid}")

    # ── S3 Buckets ────────────────────────────────────────────────────────────
    print("Creating S3 buckets...")
    for bucket_name, block_public, versioning in [
        ("my-app-assets",   False, False),
        ("my-app-backups",  True,  True),
        ("my-app-logs",     True,  False),
    ]:
        try:
            s3.create_bucket(Bucket=bucket_name)
        except ClientError:
            pass
        if block_public:
            s3.put_public_access_block(
                Bucket=bucket_name,
                PublicAccessBlockConfiguration={
                    "BlockPublicAcls": True,
                    "IgnorePublicAcls": True,
                    "BlockPublicPolicy": True,
                    "RestrictPublicBuckets": True,
                },
            )
        if versioning:
            s3.put_bucket_versioning(
                Bucket=bucket_name,
                VersioningConfiguration={"Status": "Enabled"},
            )
        print(f"  {bucket_name}: public={'NO' if block_public else 'YES'} versioning={'YES' if versioning else 'NO'}")

    # ── RDS Instance ──────────────────────────────────────────────────────────
    print("Creating RDS instance...")
    try:
        ec2.create_db_subnet_group = rds.create_db_subnet_group
        rds.create_db_subnet_group(
            DBSubnetGroupName="main-db-subnet-group",
            DBSubnetGroupDescription="Subnets for main RDS instance",
            SubnetIds=[priv1_id, priv2_id],
        )
        rds.create_db_instance(
            DBInstanceIdentifier="main-postgres",
            DBInstanceClass="db.t3.micro",
            Engine="postgres",
            EngineVersion="15.4",
            MasterUsername="admin",
            MasterUserPassword="Str0ngP@ssword!",
            AllocatedStorage=20,
            StorageEncrypted=True,
            PubliclyAccessible=False,
            DBSubnetGroupName="main-db-subnet-group",
            VpcSecurityGroupIds=[db_sg_id],
            Tags=[{"Key": "Name", "Value": "main-postgres"}],
        )
        print("  main-postgres: postgres 15.4, encrypted, private")
    except ClientError as e:
        print(f"  RDS: {e.response['Error']['Message']}")

    # ── Lambda Function ───────────────────────────────────────────────────────
    print("Creating Lambda functions...")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("handler.py", "def handler(event, context): return {'statusCode': 200, 'body': 'ok'}")
    zip_bytes = buf.getvalue()

    for fn_name, runtime, memory, timeout in [
        ("image-processor",   "python3.12", 512,  30),
        ("data-transformer",  "python3.12", 256,  60),
        ("auth-validator",    "nodejs20.x", 128,  10),
    ]:
        try:
            lmb.create_function(
                FunctionName=fn_name,
                Runtime=runtime,
                Role="arn:aws:iam::000000000000:role/lambda-basic-role",
                Handler="handler.handler",
                Code={"ZipFile": zip_bytes},
                MemorySize=memory,
                Timeout=timeout,
                Tags={"Name": fn_name},
            )
            print(f"  {fn_name}: {runtime}, {memory}MB, {timeout}s")
        except ClientError as e:
            print(f"  {fn_name}: {e.response['Error']['Message']}")

    # ── Application Load Balancer ─────────────────────────────────────────────
    print("Creating ALB...")
    try:
        alb = elb.create_load_balancer(
            Name="web-alb",
            Subnets=[pub1_id, pub2_id],
            SecurityGroups=[web_sg_id],
            Scheme="internet-facing",
            Type="application",
            IpAddressType="ipv4",
            Tags=tag("web-alb"),
        )
        alb_arn = alb["LoadBalancers"][0]["LoadBalancerArn"]
        print(f"  web-alb: {alb_arn[:50]}...")
    except ClientError as e:
        print(f"  ALB: {e.response['Error']['Message']}")

    print("\n✓ Floci seeded — run discover.py next to load into ArangoDB")


def main():
    parser = argparse.ArgumentParser(description="Seed Floci with demo AWS resources")
    parser.add_argument("--endpoint", default="http://localhost:4566", help="Floci endpoint URL")
    parser.add_argument("--region",   default="us-east-1",            help="AWS region to simulate")
    args = parser.parse_args()
    seed(args.endpoint, args.region)


if __name__ == "__main__":
    main()
