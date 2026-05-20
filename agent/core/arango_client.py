from arango import ArangoClient as _ArangoClient
from arango.database import StandardDatabase
from core.config import get_settings


def get_db() -> StandardDatabase:
    settings = get_settings()
    client = _ArangoClient(hosts=settings.arango_host)
    return client.db(
        settings.arango_db,
        username=settings.arango_username,
        password=settings.arango_password,
    )


def get_collections() -> tuple[str, str]:
    """Return (vertex_collection, edge_collection) from settings."""
    s = get_settings()
    return s.arango_vertex_collection, s.arango_edge_collection


def execute_aql(db: StandardDatabase, query: str, bind_vars: dict | None = None) -> list:
    cursor = db.aql.execute(query, bind_vars=bind_vars or {})
    return list(cursor)
