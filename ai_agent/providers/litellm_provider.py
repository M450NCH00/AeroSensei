"""LiteLLM-backed LLM provider.

LiteLLM exposes a single OpenAI-style `completion()` call that proxies to 100+
backends (OpenAI, Anthropic, Bedrock, Azure, Gemini, local Ollama, ...). The
model id selects the backend (e.g. "gpt-4o-mini", "anthropic/claude-3-5-sonnet",
"bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0", "ollama/qwen2.5:7b").

Because LiteLLM normalizes everything to the OpenAI chat-completions schema, the
tool schemas from tools.get_tool_schemas() and the message format used here are
already in the exact shape it expects.
"""
import json
import uuid
from typing import Any

import litellm

from providers.base import LLMProvider, LLMResponse, ToolCall


class LiteLLMProvider(LLMProvider):
    def __init__(
        self,
        model: str,
        api_base: str | None = None,
        api_key: str | None = None,
        context_window: int = 0,
    ):
        self.api_base = api_base or None
        self.api_key = api_key or None
        self.context_window = context_window or 0
        # LiteLLM routes by a "<provider>/<model>" prefix. When a custom endpoint
        # is configured but the model id has no prefix (e.g. "Qwen3.6-27B" served
        # by a local OpenAI-compatible server), treat it as an OpenAI-style
        # backend so LiteLLM knows how to call it.
        if self.api_base and "/" not in model:
            model = f"openai/{model}"
        self.model = model
        # Many local OpenAI-compatible servers ignore auth but still require a
        # non-empty key. Supply a placeholder so the call doesn't fail on that.
        if self.api_base and not self.api_key:
            self.api_key = "sk-no-key-required"
        # Teach LiteLLM this model's context window so token counting and
        # context-window checks work for models it doesn't ship metadata for.
        if self.context_window:
            litellm.register_model(
                {
                    self.model: {
                        "max_input_tokens": self.context_window,
                        "max_tokens": self.context_window,
                    }
                }
            )

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMResponse:
        kwargs: dict[str, Any] = {"model": self.model, "messages": messages}
        if tools:
            kwargs["tools"] = tools
        if self.api_base:
            kwargs["api_base"] = self.api_base
        if self.api_key:
            kwargs["api_key"] = self.api_key
        # Ollama sizes its context per-request via num_ctx; other providers take
        # the window from the registered model metadata above.
        if self.context_window and self.model.startswith("ollama"):
            kwargs["num_ctx"] = self.context_window

        resp = litellm.completion(**kwargs)
        message = resp.choices[0].message

        tool_calls: list[ToolCall] = []
        for tc in (message.tool_calls or []):
            raw_args = tc.function.arguments or "{}"
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except (json.JSONDecodeError, TypeError):
                args = {}
            if not isinstance(args, dict):
                args = {}
            tool_calls.append(
                ToolCall(id=tc.id or str(uuid.uuid4()), name=tc.function.name, arguments=args)
            )

        content = message.content or ""
        return LLMResponse(
            text=None if tool_calls else content,
            tool_calls=tool_calls,
            raw=message,
        )

    def append_assistant(self, messages: list[dict], response: LLMResponse) -> None:
        # Re-serialize to plain dicts in OpenAI tool-calling format.
        messages.append(
            {
                "role": "assistant",
                "content": (response.raw.content if response.raw else None) or "",
                "tool_calls": [
                    {
                        "id": c.id,
                        "type": "function",
                        "function": {
                            "name": c.name,
                            "arguments": json.dumps(c.arguments),
                        },
                    }
                    for c in response.tool_calls
                ],
            }
        )

    def append_tool_result(self, messages: list[dict], call: ToolCall, content: str) -> None:
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call.id,
                "name": call.name,
                "content": content,
            }
        )
