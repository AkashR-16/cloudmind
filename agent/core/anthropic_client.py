import anthropic
from typing import AsyncIterator

_ANTHROPIC_MODEL = "claude-3-5-haiku-latest"


async def call_anthropic(prompt: str, api_key: str) -> str:
    client = anthropic.AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model=_ANTHROPIC_MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def stream_anthropic(prompt: str, api_key: str) -> AsyncIterator[str]:
    client = anthropic.AsyncAnthropic(api_key=api_key)
    async with client.messages.stream(
        model=_ANTHROPIC_MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text
