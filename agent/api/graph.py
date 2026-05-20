from fastapi import APIRouter, Query
from ..core.arango_client import get_db, execute_aql, VERTEX_COLLECTION, EDGE_COLLECTION
from ..core.models import GraphResponse, ResourceNode
from ..core.config import get_settings

router = APIRouter(prefix="/graph", tags=["graph"])

_NODE_QUERY = """
FOR n IN {collection}
  FILTER n.kind LIKE 'aws_%'
  LIMIT @limit
  RETURN {{
    id: n._key,
    kind: n.kind,
    name: n.reported.name,
    region: n.reported.region,
    account_id: n.reported.account_id,
    tags: n.reported.tags,
    reported: n.reported
  }}
""".format(collection=VERTEX_COLLECTION)

_EDGE_QUERY = """
FOR e IN {collection}
  LIMIT @limit
  RETURN {{
    from: e._from,
    to: e._to,
    label: e.label
  }}
""".format(collection=EDGE_COLLECTION)


@router.get("/resources", response_model=GraphResponse)
async def get_resources(limit: int = Query(default=200, le=500)):
    settings = get_settings()
    effective_limit = min(limit, settings.aql_result_limit * 2)
    db = get_db()

    raw_nodes = execute_aql(db, _NODE_QUERY, {"limit": effective_limit})
    raw_edges = execute_aql(db, _EDGE_QUERY, {"limit": effective_limit * 2})

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
