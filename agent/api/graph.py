from fastapi import APIRouter, Query
from core.arango_client import get_db, execute_aql, get_collections
from core.models import GraphResponse, ResourceNode
from core.config import get_settings

router = APIRouter(prefix="/graph", tags=["graph"])

# Queries use FixInventory's real schema:
#   vertex collection = settings.arango_vertex_collection  (default: "fix")
#   edge collection   = settings.arango_edge_collection    (default: "fix_default")
#   each node has: kinds[] array, reported.kind, reported.name, reported.region, etc.
def _node_query(vertex_col: str) -> str:
    kf = "kind" if vertex_col == "node" else "reported.kind"
    return f"""
FOR n IN {{vertex}}
  FILTER n.{kf} LIKE 'aws_%'
  LIMIT @limit
  RETURN {{{{
    id: n._key,
    kind: n.{kf},
    name: n.reported.name,
    region: n.reported.region,
    account_id: n.reported.account_id,
    tags: n.reported.tags,
    reported: n.reported
  }}}}
"""

_EDGE_QUERY_TMPL = """
FOR e IN {edge}
  LIMIT @limit
  RETURN {{
    from: e._from,
    to: e._to,
    label: e.label
  }}
"""


@router.get("/resources", response_model=GraphResponse)
async def get_resources(limit: int = Query(default=200, le=500)):
    settings = get_settings()
    vertex_col, edge_col = get_collections()
    effective_limit = min(limit, settings.aql_result_limit * 2)

    db = get_db()
    raw_nodes = execute_aql(
        db,
        _node_query(vertex_col).format(vertex=vertex_col),
        {"limit": effective_limit},
    )
    raw_edges = execute_aql(
        db,
        _EDGE_QUERY_TMPL.format(edge=edge_col),
        {"limit": effective_limit * 2},
    )

    nodes = [
        ResourceNode(
            id=n.get("id", ""),
            kind=n.get("kind", "unknown"),
            name=n.get("name"),
            region=n.get("region"),
            account_id=n.get("account_id"),
            tags=n.get("tags") or {},
            reported=n.get("reported") or {},
        )
        for n in raw_nodes
    ]

    return GraphResponse(nodes=nodes, edges=raw_edges, total=len(nodes))
