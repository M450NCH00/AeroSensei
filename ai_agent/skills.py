"""Regulator skills: task-oriented playbooks over the raw tools.

A Tool (see tools.py) is one backend endpoint. A Skill is one *job a regulator
does* — it names the job, says when to reach for it, and lists the tools to call
(and in what order). The skills are rendered into the system prompt so the model
reliably maps a natural-language request to the right tool chain, instead of
guessing from 12 flat tool descriptions.

To add a skill: append a Skill to SKILLS. Every `tools` entry must be a real
tool name from tools.py (validated at import). Nothing else needs to change.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import tools


@dataclass
class Skill:
    name: str
    # One line the model reads to decide whether this skill fits the request.
    when_to_use: str
    # Tool names (from tools.py) this skill draws on.
    tools: list[str]
    # Ordered hints on how to chain the tools for a complete answer.
    steps: list[str] = field(default_factory=list)


# --- Skill catalogue (the regulator's job-to-be-done playbook) ---
SKILLS: list[Skill] = [
    Skill(
        name="Company compliance oversight",
        when_to_use=(
            "The regulator asks which companies exist, a company's overall standing, "
            "who is over/under their allowance, or who looks non-compliant."
        ),
        tools=["list_companies", "list_sectors"],
        steps=[
            "Call list_companies for the platform-wide carbon/compliance overview.",
            "If the question is about a sector benchmark or expected posture, also "
            "call list_sectors and compare each company against its sector.",
            "Flag companies whose emissions exceed their allowance or whose balance "
            "is negative; cite the concrete figures.",
        ],
    ),
    Skill(
        name="Air-quality monitoring & hotspot detection",
        when_to_use=(
            "The regulator asks about pollution levels, PM readings, a specific "
            "sensor or site, or wants to find the worst air-quality locations."
        ),
        tools=["list_sensors", "get_sensor_average", "search_sensors_by_location"],
        steps=[
            "If a place/site is named, use search_sensors_by_location; otherwise "
            "list_sensors to enumerate sites.",
            "For a specific sensor, call get_sensor_average to pull PM1.0/2.5/4.0/10.",
            "Compare PM2.5 against safe limits (<12 annual, <35 24-hour μg/m³) and "
            "call out WARNING (80-100% of limit) and CRITICAL (over limit) sites.",
        ],
    ),
    Skill(
        name="Carbon-market surveillance",
        when_to_use=(
            "The regulator wants to audit trading activity, check market integrity, "
            "or understand the current price and its trend."
        ),
        tools=["list_carbon_transactions", "get_market_price", "get_price_history"],
        steps=[
            "Call get_market_price for the current price and get_price_history for "
            "the trend.",
            "Call list_carbon_transactions for the regulator-wide trade log.",
            "Highlight unusual patterns (price spikes, concentrated counterparties, "
            "self-dealing) and quantify them.",
        ],
    ),
    Skill(
        name="Emission-report review",
        when_to_use=(
            "The regulator asks about companies' submitted emission reports for a "
            "year, or who has/hasn't reported."
        ),
        tools=["get_emission_reports"],
        steps=[
            "Resolve the reporting year (ask or use the current year if implied).",
            "Call get_emission_reports for that year and summarize submissions, "
            "missing reporters, and notable emission totals.",
        ],
    ),
    Skill(
        name="Compliance-cycle & allocation management",
        when_to_use=(
            "The regulator asks about compliance cycle phase/status, or how carbon "
            "allowances were allocated for a year."
        ),
        tools=[
            "list_compliance_cycles",
            "get_compliance_cycle",
            "get_allocation_results",
        ],
        steps=[
            "Use list_compliance_cycles for the multi-year view, or "
            "get_compliance_cycle for one year's phase/status.",
            "Call get_allocation_results for the per-company allowance allocation.",
            "Explain where the cycle stands and whether allocations look consistent "
            "with reported emissions.",
        ],
    ),
]

# Fail fast if a skill references a tool that doesn't exist.
_VALID_TOOLS = {t.name for t in tools.TOOLS}
for _s in SKILLS:
    _unknown = [t for t in _s.tools if t not in _VALID_TOOLS]
    if _unknown:
        raise ValueError(f"Skill {_s.name!r} references unknown tool(s): {_unknown}")


def render_skills() -> str:
    """Render the skill catalogue as a markdown playbook for the system prompt."""
    lines = [
        "## REGULATOR SKILLS (playbook)",
        "",
        "Each skill is a common regulator task and the tools to use for it. Match "
        "the request to a skill, then call its tools in the order described.",
        "",
    ]
    for s in SKILLS:
        lines.append(f"### {s.name}")
        lines.append(f"- When to use: {s.when_to_use}")
        lines.append(f"- Tools: {', '.join(s.tools)}")
        if s.steps:
            lines.append("- Steps:")
            lines.extend(f"  {i}. {step}" for i, step in enumerate(s.steps, 1))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"
