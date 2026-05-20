import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from main import app
from api.graph import _node_query


def test_node_query_uses_kind_for_legacy_collection():
    q = _node_query("node")
    assert "n.kind" in q
    assert "n.reported.kind" not in q


def test_node_query_uses_reported_kind_for_fix_collection():
    q = _node_query("fix")
    assert "n.reported.kind" in q


def test_node_query_filters_aws_prefix():
    q = _node_query("fix")
    assert "aws_%" in q


@pytest.fixture
def mock_graph_db():
    with (
        patch("api.graph.get_db") as mock_db,
        patch("api.graph.execute_aql") as mock_exec,
        patch("api.graph.get_collections") as mock_cols,
    ):
        mock_cols.return_value = ("fix", "fix_default")
        mock_exec.side_effect = [
            [
                {
                    "id": "i-abc123",
                    "kind": "aws_ec2_instance",
                    "name": "web-server",
                    "region": "us-east-1",
                    "account_id": "000000000000",
                    "tags": {},
                    "reported": {"kind": "aws_ec2_instance", "instance_status": "running"},
                },
                {
                    "id": "vpc-xyz",
                    "kind": "aws_vpc",
                    "name": "main-vpc",
                    "region": "us-east-1",
                    "account_id": "000000000000",
                    "tags": {},
                    "reported": {"kind": "aws_vpc", "cidr_block": "10.0.0.0/16"},
                },
            ],
            [],  # edges
        ]
        yield


@pytest.mark.asyncio
async def test_graph_resources_returns_200(mock_graph_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/graph/resources")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_graph_resources_response_shape(mock_graph_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/graph/resources")
    body = res.json()
    assert "nodes" in body
    assert "edges" in body
    assert "total" in body
    assert body["total"] == 2


@pytest.mark.asyncio
async def test_graph_resources_node_fields(mock_graph_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/graph/resources")
    node = res.json()["nodes"][0]
    assert node["id"] == "i-abc123"
    assert node["kind"] == "aws_ec2_instance"
    assert node["region"] == "us-east-1"


@pytest.mark.asyncio
async def test_graph_resources_limit_cap(mock_graph_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/graph/resources?limit=999")
    assert res.status_code == 422  # exceeds le=500
