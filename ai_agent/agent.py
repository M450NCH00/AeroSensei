"""The tool-calling agent loop.

Orchestrates: system prompt + history + question -> LLM -> (tool calls -> backend
-> results -> LLM)* -> final answer. Provider-agnostic; all model specifics live
behind the LLMProvider interface.
"""
import logging

import config
import skills
import tools
from knowledge_base import SYSTEM_PROMPT

log = logging.getLogger("agent")

# Roles allowed in the inbound conversation history.
_HISTORY_ROLES = {"user", "assistant"}

# System prompt + the regulator skill playbook (built once at import).
_SYSTEM_PROMPT = SYSTEM_PROMPT.rstrip() + "\n\n" + skills.render_skills()


def _build_messages(question: str, history: list[dict]) -> list[dict]:
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for m in history or []:
        role = m.get("role")
        content = m.get("content")
        if role in _HISTORY_ROLES and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})
    return messages


def _fmt2(value):
    """Round a numeric PM reading to 2 decimals for display, trimming float noise
    (e.g. 72.34000000000001 -> "72.34"). Non-numeric/None values pass through."""
    if isinstance(value, (int, float)):
        return f"{value:.2f}"
    return value


def _fallback_alert(alert: dict) -> str:
    """Deterministic advisory used when the LLM is unavailable or errors out.

    `alert` mirrors a pm_alerts row (site_name, sensor_id, pm_type,
    measured_value, threshold_value, alert_level, triggered_at, note).
    """
    site = (
        alert.get("site_name")
        or alert.get("site")
        or alert.get("sensor_id")
        or "an unknown site"
    )
    pm_type = (alert.get("pm_type") or "PM").upper()
    measured = _fmt2(alert.get("measured_value"))
    threshold = _fmt2(alert.get("threshold_value"))
    level = (alert.get("alert_level") or "WARNING").upper()
    measured_str = f"{measured} µg/m³" if measured is not None else "above the limit"
    threshold_str = f" (threshold {threshold} µg/m³)" if threshold is not None else ""
    icon = "🔴" if level in ("BREACHED", "CRITICAL") else "⚠️"
    note = f" Note: {alert['note']}." if alert.get("note") else ""
    return (
        f"{icon} {level} air-quality alert — Site {site}: {pm_type} reached "
        f"{measured_str}{threshold_str}. Sensitive groups should limit outdoor exposure; "
        f"regulators should review the affected site.{note}"
    )


def compose_alert(alert: dict) -> str:
    """Turn a pm_alerts row from the backend into a short Telegram advisory.

    By default the message is a deterministic template (ALERT_USE_LLM off) — the
    alert is built from structured fields, so this is instant, free, and can't be
    delayed or mangled by the model. When ALERT_USE_LLM is enabled, the LLM rephrases
    it and falls back to the same template on any error — the alert must still go out.

    Expected keys (pm_alerts schema): id, sensor_id, site_name, pm_type,
    measured_value, threshold_value, alert_level, triggered_at, resolved_at, note.
    All optional except measured_value (validated by the caller).
    """
    if not config.ALERT_USE_LLM:
        return _fallback_alert(alert)
    try:
        provider = config.get_provider()
        facts = ", ".join(f"{k}={v}" for k, v in alert.items() if v is not None)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are the AeroSense air-quality alerting assistant. Write a single, "
                    "concise Telegram alert (max 3 short sentences, plain text, no markdown) "
                    "warning that a SITE's PM level has breached its threshold. Refer to the "
                    "location by its site name (the site_name field, e.g. 'Site VPBank') — "
                    "never by a sensor id like 'SITE-1'. State the site name, the PM type, the "
                    "measured value vs. the threshold, and the alert level (warning/critical), "
                    "then give a brief recommended action. Do not invent data beyond what is "
                    "provided."
                ),
            },
            {"role": "user", "content": f"pm_alerts record: {facts}"},
        ]
        text = (provider.chat(messages, tools=[]).text or "").strip()
        if text:
            return text
    except Exception:
        log.exception("LLM alert composition failed; using deterministic fallback")
    return _fallback_alert(alert)


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
