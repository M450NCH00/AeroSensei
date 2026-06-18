"""Tool layer: read-only wrappers over the existing backend REST endpoints.

Each tool maps to one Spring Boot endpoint. The caller's JWT (the accessToken
cookie) is forwarded on every request, so the backend enforces auth, role checks
(@PreAuthorize hasAnyRole('GOVERNMENT','ADMIN')), and all business logic over
Postgres + InfluxDB. The agent generates no SQL/Flux and holds no DB creds.

To add a tool: append a Tool to TOOLS. Nothing else needs to change.
"""
import json
from dataclasses import dataclass
from typing import Any, Callable

import requests

import config


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict  # JSON schema for the arguments object
    # Build (path, query_params) from the LLM-supplied arguments.
    build: Callable[[dict], tuple[str, dict]]


def _backend_get(path: str, params: dict, token: str) -> Any:
    """GET a backend endpoint, forwarding the caller's accessToken cookie."""
    url = f"{config.BACKEND_BASE_URL}{path}"
    resp = requests.get(
        url,
        params={k: v for k, v in params.items() if v is not None},
        cookies={"accessToken": token},
        timeout=config.BACKEND_TIMEOUT,
    )
    resp.raise_for_status()
    if resp.content:
        try:
            return resp.json()
        except ValueError:
            return resp.text
    return None


# --- Tool definitions (all read-only GETs) ---
TOOLS: list[Tool] = [
    Tool(
        name="list_companies",
        description=(
            "List all registered companies with their carbon/compliance overview "
            "(allowances, emissions posture, balances). Use for questions about "
            "which companies exist or their overall standing."
        ),
        parameters={"type": "object", "properties": {}},
        build=lambda a: ("/api/carbon/gov/companies", {}),
    ),
    Tool(
        name="list_sectors",
        description="List all industry sectors and their configuration/benchmarks.",
        parameters={"type": "object", "properties": {}},
        build=lambda a: ("/api/sectors", {}),
    ),
    Tool(
        name="list_carbon_transactions",
        description=(
            "List all carbon-credit trades across the marketplace (regulator-wide "
            "view). Use to audit trading activity or market integrity."
        ),
        parameters={"type": "object", "properties": {}},
        build=lambda a: ("/api/carbon/gov/transactions", {}),
    ),
    Tool(
        name="get_market_price",
        description="Get the current carbon-credit market price.",
        parameters={"type": "object", "properties": {}},
        build=lambda a: ("/api/carbon/market-price", {}),
    ),
    Tool(
        name="get_price_history",
        description="Get the historical carbon-credit price series for trend analysis.",
        parameters={"type": "object", "properties": {}},
        build=lambda a: ("/api/carbon/price-history", {}),
    ),
    Tool(
        name="get_emission_reports",
        description="Get all companies' submitted emission reports for a given year.",
        parameters={
            "type": "object",
            "properties": {
                "year": {"type": "integer", "description": "Reporting year, e.g. 2025"}
            },
            "required": ["year"],
        },
        build=lambda a: (f"/api/allocations/reports/{int(a['year'])}", {}),
    ),
    Tool(
        name="list_compliance_cycles",
        description="List all compliance cycles and their status across years.",
        parameters={"type": "object", "properties": {}},
        build=lambda a: ("/api/allocations/cycles", {}),
    ),
    Tool(
        name="get_compliance_cycle",
        description="Get the compliance cycle (phase/status) for a specific year.",
        parameters={
            "type": "object",
            "properties": {"year": {"type": "integer", "description": "Cycle year"}},
            "required": ["year"],
        },
        build=lambda a: (f"/api/allocations/cycle/{int(a['year'])}", {}),
    ),
    Tool(
        name="get_allocation_results",
        description="Get the carbon allocation results for all companies for a given year.",
        parameters={
            "type": "object",
            "properties": {"year": {"type": "integer", "description": "Allocation year"}},
            "required": ["year"],
        },
        build=lambda a: (f"/api/allocations/results/{int(a['year'])}", {}),
    ),
    Tool(
        name="list_sensors",
        description=(
            "List all registered air-quality sensors with their location/metadata "
            "and latest info. Use for questions about sensors or sites."
        ),
        parameters={"type": "object", "properties": {}},
        build=lambda a: ("/api/sensors/info", {}),
    ),
    Tool(
        name="get_sensor_average",
        description=(
            "Get average air-quality readings (PM1.0/PM2.5/PM4.0/PM10) for a "
            "specific sensor, sourced from the time-series database."
        ),
        parameters={
            "type": "object",
            "properties": {
                "sensorId": {"type": "string", "description": "The sensor's id"}
            },
            "required": ["sensorId"],
        },
        build=lambda a: (f"/api/sensors/{a['sensorId']}/average", {}),
    ),
    Tool(
        name="search_sensors_by_location",
        description="Find sensors and their readings by location/place name.",
        parameters={
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "Location or place name"}
            },
            "required": ["location"],
        },
        build=lambda a: ("/api/sensors/search", {"location": a["location"]}),
    ),
]

_TOOLS_BY_NAME = {t.name: t for t in TOOLS}


def get_tool_schemas() -> list[dict]:
    """Tool schemas in the OpenAI/Ollama function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            },
        }
        for t in TOOLS
    ]


def execute_tool(name: str, arguments: dict, token: str) -> str:
    """Run a tool by name and return its result as a JSON string for the model."""
    tool = _TOOLS_BY_NAME.get(name)
    if tool is None:
        return json.dumps({"error": f"Unknown tool: {name}"})
    try:
        path, params = tool.build(arguments or {})
        data = _backend_get(path, params, token)
        return json.dumps({"data": data}, default=str)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        return json.dumps({"error": f"Backend returned HTTP {status} for {name}"})
    except (KeyError, ValueError, TypeError) as e:
        return json.dumps({"error": f"Invalid arguments for {name}: {e}"})
    except requests.RequestException as e:
        return json.dumps({"error": f"Could not reach backend for {name}: {e}"})
