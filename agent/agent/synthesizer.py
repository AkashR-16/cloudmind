import json
from typing import AsyncIterator
from core.gemini_client import get_model
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
) -> list[dict]:
    if db_results:
        data_str = json.dumps(db_results, indent=2)
    else:
        data_str = "No matching resources found."

    system_with_data = (
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

    messages = [{"role": "user", "parts": [system_with_data]},
                {"role": "model", "parts": ["Understood. I'll answer questions based on this AWS environment data."]}]

    for msg in history:
        role = "user" if msg.role == "user" else "model"
        messages.append({"role": role, "parts": [msg.content]})

    messages.append({"role": "user", "parts": [intent.raw_question]})
    return messages


async def synthesize_stream(
    intent: Intent,
    db_results: list,
    history: list[ChatMessage],
) -> AsyncIterator[str]:
    model = get_model()
    messages = _build_messages(intent, db_results, history)

    response = model.generate_content(messages, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text


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
