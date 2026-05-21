import json
from core.llm_router import call_llm
from core.models import Intent, IntentType

_INTENT_PROMPT = """You are an AWS infrastructure assistant intent classifier.

Classify the user question into one of these intents:
- resource_query: asking about specific resources (EC2, S3, RDS, VPC, etc.)
- topology_query: asking about relationships or network topology
- security_query: asking about security groups, IAM, public access, vulnerabilities
- count_query: asking how many of something
- cost_query: asking about cost or pricing
- unknown: out of scope (weather, general knowledge, etc.)

Also extract entities: resource types, regions, filters mentioned.
If the question is a follow-up (uses pronouns like "they", "those", "it", "them") use the conversation history to infer the resource type.

Respond with valid JSON only. Example:
{{"intent": "resource_query", "entities": {{"resource_type": "aws_ec2_instance", "region": "us-east-1"}}}}

{history_block}Question: {question}
"""


async def classify_intent(question: str, history: list | None = None, api_key: str | None = None, provider: str | None = None) -> Intent:
    history_block = ""
    if history:
        recent = history[-4:]  # last 2 turns
        lines = "\n".join(f"{m.role}: {m.content[:200]}" for m in recent)
        history_block = f"Recent conversation:\n{lines}\n\n"

    prompt = _INTENT_PROMPT.format(question=question, history_block=history_block)

    try:
        text = await call_llm(prompt, api_key=api_key, provider=provider)
    except Exception as e:
        raise RuntimeError(f"LLM error: {e}") from e

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        data = json.loads(text)
        return Intent(
            type=IntentType(data.get("intent", "unknown")),
            entities=data.get("entities") or {},
            raw_question=question,
        )
    except (json.JSONDecodeError, ValueError):
        return Intent(type=IntentType.unknown, raw_question=question)
