import json
from ..core.gemini_client import get_aql_model
from ..core.models import Intent, IntentType

_INTENT_PROMPT = """You are an AWS infrastructure assistant intent classifier.

Classify the user question into one of these intents:
- resource_query: asking about specific resources (EC2, S3, RDS, VPC, etc.)
- topology_query: asking about relationships or network topology
- security_query: asking about security groups, IAM, public access, vulnerabilities
- count_query: asking how many of something
- cost_query: asking about cost or pricing
- unknown: out of scope (weather, general knowledge, etc.)

Also extract entities: resource types, regions, filters mentioned.

Respond with valid JSON only. Example:
{{"intent": "resource_query", "entities": {{"resource_type": "aws_ec2_instance", "region": "us-east-1"}}}}

Question: {question}
"""


async def classify_intent(question: str) -> Intent:
    model = get_aql_model()
    try:
        response = model.generate_content(_INTENT_PROMPT.format(question=question))
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            raise RuntimeError("RESOURCE_EXHAUSTED: Gemini quota exceeded")
        raise
    text = response.text.strip()

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
            entities=data.get("entities", {}),
            raw_question=question,
        )
    except (json.JSONDecodeError, ValueError):
        return Intent(type=IntentType.unknown, raw_question=question)
