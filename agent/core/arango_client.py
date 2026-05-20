from arango import ArangoClient as _ArangoClient
from arango.database import StandardDatabase
from functools import lru_cache
from .config import get_settings


def get_db() -> StandardDatabase:
    settings = get_settings()
    client = _ArangoClient(hosts=settings.arango_host)
    return client.db(
        settings.arango_db,
        username=settings.arango_username,
        password=settings.arango_password,
    )


# FixInventory stores all resources in a unified vertex collection named after
# the graph (default: "fix"). Resources have a `kind` field for the resource
# type and a `reported` dict for actual AWS properties.
# Edges live in the `fix_default` edge collection.
VERTEX_COLLECTION = "node"
EDGE_COLLECTION = "default"


def execute_aql(db: StandardDatabase, query: str, bind_vars: dict | None = None) -> list:
    cursor = db.aql.execute(query, bind_vars=bind_vars or {})
    return list(cursor)
