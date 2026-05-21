import json
from typing import AsyncIterator
from core.llm_router import stream_llm
from core.models import ChatMessage, Intent

_SYSTEM_PROMPT = """You are CloudMind, an expert AI assistant specializing in AWS cloud infrastructure.

You have access to real-time data from the user's AWS environment discovered by FixInventory.
Answer questions clearly, concisely, and accurately based ONLY on the provided data.

Guidelines:
- Be specific: include resource names, IDs, regions when available
- Flag security concerns proactively (e.g. public S3 buckets, overly permissive security groups)
- If data is empty, say so clearly — do not fabricate resources
- Keep answers focused — don't repeat the question back
- Use bullet points for lists of resources
- For follow-up questions, use the conversation history as context
"""


def _build_messages(
    intent: Intent,
    db_results: list,
    history: list[ChatMessage],
    aql_error: str | None = None,
) -> tuple[str, list[dict]]:
    if aql_error:
        data_str = "QUERY FAILED — unable to retrieve data. Do not say 'no resources found'. Instead say the query could not be completed and ask the user to rephrase."
    elif db_results:
        data_str = json.dumps(db_results, indent=2)
    else:
        data_str = "No matching resources found."

    system = (
        f"{_SYSTEM_PROMPT}\n\n"
        f"=== Query Context ===\n"
        f"Question: {intent.raw_question}\n"
        f"Intent type: {intent.type.value}\n"
        f"Entities extracted: {intent.entities}\n\n"
        f"=== AWS Environment Data (query results) ===\n{data_str}\n"
        f"=== End of Data ===\n"
        f"Note: if the data is a single number (e.g. [3]), it is the COUNT of resources "
        f"matching the query filters above. Use it to answer the question directly.\n"
    )

    messages: list[dict] = []
    for msg in history:
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": intent.raw_question})
    return system, messages


def _build_cli_prompt(system: str, messages: list[dict]) -> str:
    """Combine system prompt + conversation history into a single CLI prompt string."""
    parts = [system, "\n\n"]
    for msg in messages[:-1]:
        label = "User" if msg["role"] == "user" else "Assistant"
        parts.append(f"{label}: {msg['content']}\n")
    if len(messages) > 1:
        parts.append("\n")
    parts.append(f"User: {messages[-1]['content']}")
    return "".join(parts)


async def synthesize_stream(
    intent: Intent,
    db_results: list,
    history: list[ChatMessage],
    aql_error: str | None = None,
    api_key: str | None = None,
    provider: str | None = None,
) -> AsyncIterator[str]:
    system, messages = _build_messages(intent, db_results, history, aql_error=aql_error)
    prompt = _build_cli_prompt(system, messages)
    async for chunk in stream_llm(prompt, api_key=api_key, provider=provider):
        yield chunk


async def synthesize_unknown(question: str) -> AsyncIterator[str]:
    """Handle out-of-scope questions gracefully."""
    yield (
        "I specialize in AWS cloud infrastructure questions. "
        "I can help you with things like:\n"
        "- EC2 instances, S3 buckets, VPCs, security groups\n"
        "- IAM roles and policies\n"
        "- Resource relationships and topology\n"
        "- Security and compliance concerns\n\n"
        f"Your question — *\"{question}\"* — is outside my scope. "
        "Please ask me something about your AWS environment."
    )
