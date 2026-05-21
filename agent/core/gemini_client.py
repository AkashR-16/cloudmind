import google.generativeai as genai
from typing import AsyncIterator

_GEMINI_MODEL = "gemini-2.0-flash-lite"


def _make_model(api_key: str, temperature: float = 0.2):
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        model_name=_GEMINI_MODEL,
        generation_config=genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=8192,
        ),
    )


async def call_gemini(prompt: str, api_key: str, temperature: float = 0.2) -> str:
    model = _make_model(api_key, temperature)
    response = await model.generate_content_async(prompt)
    return response.text.strip()


async def stream_gemini(prompt: str, api_key: str) -> AsyncIterator[str]:
    model = _make_model(api_key)
    async for chunk in await model.generate_content_async(prompt, stream=True):
        if chunk.text:
            yield chunk.text
