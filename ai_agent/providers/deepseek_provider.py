"""DeepSeek-backed LLM provider (direct HTTP, no LiteLLM).

Talks straight to DeepSeek's OpenAI-compatible chat-completions API
(https://api.deepseek.com/chat/completions) with `requests`. DeepSeek returns
the standard OpenAI schema, so the tool schemas from tools.get_tool_schemas()
and the message format used here are already in the exact shape it expects.
"""
import json
import uuid
from typing import Any

import requests

from providers.base import LLMProvider, LLMResponse, ToolCall


class DeepSeekProvider(LLMProvider):
    def __init__(self, model: str, api_key: str, api_base: str = "https://api.deepseek.com",
                 timeout: float = 60.0):
        if not api_key:
            raise ValueError("DeepSeekProvider requires an api_key (DEEPSEEK_API_KEY).")
        self.model = model
        self.api_key = api_key
        # Accept either "https://api.deepseek.com" or ".../v1"; normalize to the endpoint.
        self.url = api_base.rstrip("/") + "/chat/completions"
        self.timeout = timeout

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMResponse:
        payload: dict[str, Any] = {"model": self.model, "messages": messages}
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        resp = requests.post(
            self.url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self.timeout,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"DeepSeek API error {resp.status_code}: {resp.text}")

        message = resp.json()["choices"][0]["message"]

        tool_calls: list[ToolCall] = []
        for tc in (message.get("tool_calls") or []):
            fn = tc.get("function") or {}
            raw_args = fn.get("arguments") or "{}"
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except (json.JSONDecodeError, TypeError):
                args = {}
            if not isinstance(args, dict):
                args = {}
            tool_calls.append(
                ToolCall(id=tc.get("id") or str(uuid.uuid4()), name=fn.get("name"), arguments=args)
            )

        content = message.get("content") or ""
        return LLMResponse(
            text=None if tool_calls else content,
            tool_calls=tool_calls,
            raw=message,
        )

    def append_assistant(self, messages: list[dict], response: LLMResponse) -> None:
        messages.append(
            {
                "role": "assistant",
                "content": (response.raw.get("content") if response.raw else None) or "",
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
