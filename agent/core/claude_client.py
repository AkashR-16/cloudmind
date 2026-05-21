"""
Calls the local `claude` CLI binary (already authenticated via Claude Code).
No API key required — uses your existing Claude Code session.
"""
import asyncio
import glob
import json
import os
import shutil
from typing import AsyncIterator


def _find_claude_bin() -> str:
    # Try system PATH first
    path = shutil.which("claude")
    if path:
        return path
    # Fall back to VS Code extension binary (macOS)
    vscode_ext = os.path.expanduser("~/.vscode/extensions/")
    matches = glob.glob(f"{vscode_ext}anthropic.claude-code-*/resources/native-binary/claude")
    if matches:
        return sorted(matches)[-1]
    raise RuntimeError(
        "claude CLI not found. Make sure Claude Code (VS Code extension) is installed."
    )


CLAUDE_BIN = _find_claude_bin()


async def call_claude(prompt: str) -> str:
    """Single non-streaming call — returns full response text."""
    proc = await asyncio.create_subprocess_exec(
        CLAUDE_BIN, "-p", prompt,
        "--output-format", "text",
        "--no-session-persistence",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"Claude CLI error: {stderr.decode().strip()}")
    return stdout.decode().strip()


async def stream_claude(prompt: str) -> AsyncIterator[str]:
    """Streaming call — yields text chunks as they arrive."""
    proc = await asyncio.create_subprocess_exec(
        CLAUDE_BIN, "-p", prompt,
        "--output-format", "stream-json",
        "--include-partial-messages",
        "--no-session-persistence",
        "--verbose",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    async for raw_line in proc.stdout:
        line = raw_line.decode().strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue

        # Extract text deltas from streaming events
        if (
            data.get("type") == "stream_event"
            and data.get("event", {}).get("type") == "content_block_delta"
            and data.get("event", {}).get("delta", {}).get("type") == "text_delta"
        ):
            text = data["event"]["delta"]["text"]
            if text:
                yield text

    await proc.wait()
