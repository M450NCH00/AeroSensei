"""Ollama-backed LLM provider.

Uses the local Ollama server's chat API, which supports OpenAI-style tool
calling for tool-capable models (qwen2.5, llama3.1, mistral-nemo, ...).
"""
import uuid
from typing import Any

import ollama

from providers.base import LLMProvider, LLMResponse, ToolCall


def _get(obj: Any, key: str, default=None):
    """Read `key` from a dict or a pydantic-style object (ollama returns both
    across versions)."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


class OllamaProvider(LLMProvider):
    def __init__(self, model: str, host: str):
        self.model = model
        self.client = ollama.Client(host=host)

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMResponse:
        resp = self.client.chat(model=self.model, messages=messages, tools=tools)
        message = _get(resp, "message")

        raw_tool_calls = _get(message, "tool_calls") or []
        tool_calls: list[ToolCall] = []
        for tc in raw_tool_calls:
            fn = _get(tc, "function")
            args = _get(fn, "arguments") or {}
            if not isinstance(args, dict):
                args = {}
            tool_calls.append(
                ToolCall(id=str(uuid.uuid4()), name=_get(fn, "name"), arguments=args)
            )

        content = _get(message, "content") or ""
        return LLMResponse(
            text=None if tool_calls else content,
            tool_calls=tool_calls,
            raw=message,
        )

    def append_assistant(self, messages: list[dict], response: LLMResponse) -> None:
        # Re-serialize to plain dicts so the message list stays JSON-friendly.
        messages.append(
            {
                "role": "assistant",
                "content": _get(response.raw, "content") or "",
                "tool_calls": [
                    {"function": {"name": c.name, "arguments": c.arguments}}
                    for c in response.tool_calls
                ],
            }
        )

    def append_tool_result(self, messages: list[dict], call: ToolCall, content: str) -> None:
        messages.append({"role": "tool", "tool_name": call.name, "content": content})
