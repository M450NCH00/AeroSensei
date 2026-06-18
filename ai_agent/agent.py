"""The tool-calling agent loop.

Orchestrates: system prompt + history + question -> LLM -> (tool calls -> backend
-> results -> LLM)* -> final answer. Provider-agnostic; all model specifics live
behind the LLMProvider interface.
"""
import logging

import config
import tools
from knowledge_base import SYSTEM_PROMPT

log = logging.getLogger("agent")

# Roles allowed in the inbound conversation history.
_HISTORY_ROLES = {"user", "assistant"}


def _build_messages(question: str, history: list[dict]) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in history or []:
        role = m.get("role")
        content = m.get("content")
        if role in _HISTORY_ROLES and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})
    return messages


def run(question: str, history: list[dict], token: str) -> str:
    """Answer `question` for an authorized caller, using tools as needed.

    `token` is the caller's JWT, forwarded to the backend on every tool call.
    """
    provider = config.get_provider()
    tool_schemas = tools.get_tool_schemas()
    messages = _build_messages(question, history)

    for iteration in range(config.MAX_TOOL_ITERATIONS):
        response = provider.chat(messages, tool_schemas)

        if not response.wants_tools:
            return response.text or "I wasn't able to produce an answer."

        provider.append_assistant(messages, response)
        for call in response.tool_calls:
            log.info("tool call: %s args=%s", call.name, call.arguments)
            result = tools.execute_tool(call.name, call.arguments, token)
            provider.append_tool_result(messages, call, result)

    # Hit the iteration cap: ask the model to answer from what it has gathered.
    messages.append(
        {
            "role": "user",
            "content": (
                "Provide your best final answer now using the data already "
                "gathered. Do not call any more tools."
            ),
        }
    )
    final = provider.chat(messages, tools=[])
    return final.text or "I gathered some data but couldn't finish the analysis in time."
