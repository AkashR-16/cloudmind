"""
Routes LLM calls to either the local Claude Code CLI or the user-provided Gemini key.

Local mode  : Claude Code CLI is on PATH (dev machine with Claude Code installed)
Deployed mode: No CLI binary — caller must supply api_key, routed to Gemini.
"""
import glob
import os
import shutil
from typing import AsyncIterator

_claude_bin: str | None = None
_probed = False


def _find_claude() -> str | None:
    path = shutil.which("claude")
    if path:
        return path
    vscode_ext = os.path.expanduser("~/.vscode/extensions/")
    matches = glob.glob(
        f"{vscode_ext}anthropic.claude-code-*/resources/native-binary/claude"
    )
    return sorted(matches)[-1] if matches else None


def is_local_mode() -> bool:
    """True when the Claude Code CLI binary is available (dev/local environment)."""
    global _claude_bin, _probed
    if not _probed:
        _claude_bin = _find_claude()
        _probed = True
    return bool(_claude_bin)


async def call_llm(prompt: str, api_key: str | None = None, provider: str | None = None) -> str:
    if api_key:
        if provider == "openai":
            from core.openai_client import call_openai
            return await call_openai(prompt, api_key)
        if provider == "anthropic":
            from core.anthropic_client import call_anthropic
            return await call_anthropic(prompt, api_key)
        # default / "gemini"
        from core.gemini_client import call_gemini
        return await call_gemini(prompt, api_key)
    if is_local_mode():
        from core.claude_client import call_claude
        return await call_claude(prompt)
    raise RuntimeError("no_api_key")


async def stream_llm(prompt: str, api_key: str | None = None, provider: str | None = None) -> AsyncIterator[str]:
    if api_key:
        if provider == "openai":
            from core.openai_client import stream_openai
            async for chunk in stream_openai(prompt, api_key):
                yield chunk
            return
        if provider == "anthropic":
            from core.anthropic_client import stream_anthropic
            async for chunk in stream_anthropic(prompt, api_key):
                yield chunk
            return
        # default / "gemini"
        from core.gemini_client import stream_gemini
        async for chunk in stream_gemini(prompt, api_key):
            yield chunk
        return
    if is_local_mode():
        from core.claude_client import stream_claude
        async for chunk in stream_claude(prompt):
            yield chunk
        return
    raise RuntimeError("no_api_key")
