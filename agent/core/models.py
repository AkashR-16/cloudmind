from pydantic import BaseModel, Field
from typing import Any
from enum import Enum


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(..., min_length=1, max_length=128)


class SessionResponse(BaseModel):
    session_id: str
    turn_count: int
    history: list[ChatMessage]


class ResourceNode(BaseModel):
    id: str
    kind: str
    name: str | None
    region: str | None
    account_id: str | None
    tags: dict[str, str] = {}
    reported: dict[str, Any] = {}


class GraphResponse(BaseModel):
    nodes: list[ResourceNode]
    edges: list[dict[str, Any]]
    total: int


class IntentType(str, Enum):
    resource_query = "resource_query"
    topology_query = "topology_query"
    security_query = "security_query"
    cost_query = "cost_query"
    count_query = "count_query"
    unknown = "unknown"


class Intent(BaseModel):
    type: IntentType
    entities: dict[str, Any] = {}
    raw_question: str
