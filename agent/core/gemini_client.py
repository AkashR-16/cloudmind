import google.generativeai as genai
from google.generativeai import GenerativeModel
from functools import lru_cache
from core.config import get_settings


@lru_cache
def get_model() -> GenerativeModel:
    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel(
        model_name="gemini-3.1-flash-lite",
        generation_config=genai.GenerationConfig(
            temperature=0.2,
            max_output_tokens=8192,
        ),
    )


@lru_cache
def get_aql_model() -> GenerativeModel:
    """Lower temperature model for deterministic AQL generation."""
    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel(
        model_name="gemini-3.1-flash-lite",
        generation_config=genai.GenerationConfig(
            temperature=0.0,
            max_output_tokens=8192,
            # thinking_budget=0 disables chain-of-thought so all tokens go to output
        ),
    )
