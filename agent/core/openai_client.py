from openai import AsyncOpenAI
from typing import AsyncIterator

_OPENAI_MODEL = "gpt-4o-mini"


async def call_openai(prompt: str, api_key: str) -> str:
    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=_OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=8192,
    )
    return (response.choices[0].message.content or "").strip()


async def stream_openai(prompt: str, api_key: str) -> AsyncIterator[str]:
    client = AsyncOpenAI(api_key=api_key)
    stream = await client.chat.completions.create(
        model=_OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=8192,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
