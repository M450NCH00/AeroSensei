"""Provider-agnostic LLM interface.

Each concrete provider translates its native request/response format into the
normalized shapes below, and knows how to append assistant + tool messages back
onto the running message list in the format its API expects. This keeps the
agent loop identical regardless of whether we run on Ollama or Bedrock.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolCall:
    """A single tool invocation requested by the model."""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    """Normalized result of one chat turn.

    Either `text` is set (final answer) or `tool_calls` is non-empty (the model
    wants tools run). `raw` holds the provider's original assistant message so the
    provider can append it verbatim on the next turn.
    """
    text: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw: Any = None

    @property
    def wants_tools(self) -> bool:
        return bool(self.tool_calls)


class LLMProvider(ABC):
    """Base class for all LLM backends."""

    @abstractmethod
    def chat(self, messages: list[dict], tools: list[dict]) -> LLMResponse:
        """Run one chat completion with the given messages and tool schemas."""

    @abstractmethod
    def append_assistant(self, messages: list[dict], response: LLMResponse) -> None:
        """Append the model's tool-calling turn to `messages` (in-place)."""

    @abstractmethod
    def append_tool_result(self, messages: list[dict], call: ToolCall, content: str) -> None:
        """Append a tool's result to `messages` (in-place)."""
