"""Autonomous enforcement: the agent auto-issues fines for BREACHED alerts.

Triggered server-to-server (the backend's nightly PM-breach check calls
POST /enforce). With no human in the loop, the agent assumes a government system
identity (a short-lived JWT minted from the shared secret) and:

  1. lists all PM-breach alerts,
  2. selects those that are BREACHED and not yet fined,
  3. computes the fine amount DETERMINISTICALLY from how far the 24h average
     exceeded the QCVN limit (the LLM does NOT pick the number — penalties must be
     predictable and defensible), while the LLM writes the human-readable reason,
  4. issues the fine via the same backend endpoint a regulator would use.

Safety: the whole sweep is gated behind config.ENFORCEMENT_AUTO_FINE (off by
default); the backend independently re-checks the system token's role and refuses
to fine the same alert twice — so this is safe to re-run.
"""
from __future__ import annotations

import logging

import auth
import config
import tools

log = logging.getLogger("enforcement")


def _fine_amount(measured: float, threshold: float) -> float:
    """Deterministic VND penalty scaled by how far `measured` exceeds `threshold`."""
    if not threshold or threshold <= 0:
        return config.FINE_BASE_AMOUNT
    over = max(0.0, measured / threshold - 1.0)
    amount = config.FINE_BASE_AMOUNT + over * config.FINE_PER_RATIO
    amount = min(amount, config.FINE_MAX_AMOUNT)
    if config.FINE_ROUND > 0:
        amount = round(amount / config.FINE_ROUND) * config.FINE_ROUND
    return float(amount)


def _compose_reason(alert: dict, amount: float) -> str:
    """LLM-written one-line justification for the fine, with a deterministic fallback."""
    pm_type = (alert.get("pmType") or "PM").upper()
    measured = alert.get("measuredValue")
    threshold = alert.get("thresholdValue")
    site = alert.get("siteName") or f"site {alert.get('siteId')}"
    fallback = (
        f"Automated enforcement: {site} recorded a 24h average {pm_type} of "
        f"{measured} µg/m³, breaching the QCVN 05:2023 limit of {threshold} µg/m³. "
        f"Fine of {amount:,.0f} VND issued."
    )
    try:
        provider = config.get_provider()
        facts = ", ".join(f"{k}={v}" for k, v in alert.items() if v is not None)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are the AeroSense enforcement assistant. Write ONE concise, "
                    "formal sentence (plain text, no markdown) justifying a fine against "
                    "a company site for breaching Vietnam's QCVN 05:2023 PM limit. State "
                    "the PM type, the measured 24h average vs the threshold, and that the "
                    f"fine is {amount:,.0f} VND. Do not invent data beyond what is provided."
                ),
            },
            {"role": "user", "content": f"pm_alerts record: {facts}"},
        ]
        text = (provider.chat(messages, tools=[]).text or "").strip()
        return text or fallback
    except Exception:
        log.exception("LLM reason composition failed; using deterministic fallback")
        return fallback


def _is_breached_unfined(alert: dict) -> bool:
    level = str(alert.get("alertLevel") or "").upper()
    return level == "BREACHED" and not alert.get("fined")


def run_auto_fine_sweep() -> dict:
    """Fine every BREACHED, un-fined alert. Returns a summary for the caller/logs."""
    if not config.ENFORCEMENT_AUTO_FINE:
        log.info("Auto-fine sweep requested but ENFORCEMENT_AUTO_FINE is disabled.")
        return {"enabled": False, "candidates": 0, "fined": 0, "errors": 0, "results": []}

    # No human caller -> act under a government system identity the backend trusts.
    token = auth.mint_system_token()

    raw = tools._backend_get("/api/alerts", {}, token)
    alerts = raw if isinstance(raw, list) else (raw or {}).get("data") or []
    targets = [a for a in alerts if _is_breached_unfined(a)]
    log.info(
        "Auto-fine sweep: %d breached, un-fined alert(s) of %d total.",
        len(targets), len(alerts),
    )

    fined = errors = 0
    results: list[dict] = []
    for alert in targets:
        alert_id = alert.get("id")
        measured = float(alert.get("measuredValue") or 0)
        threshold = float(alert.get("thresholdValue") or 0)
        amount = _fine_amount(measured, threshold)
        reason = _compose_reason(alert, amount)
        try:
            tools._backend_post(
                f"/api/alerts/{int(alert_id)}/fine",
                {"amount": amount, "reason": reason},
                token,
            )
            fined += 1
            results.append({"alertId": alert_id, "amount": amount, "status": "fined"})
            log.info("Auto-fined alert %s: %.0f VND — %s", alert_id, amount, reason)
        except Exception as e:  # backend rejects (already fined / role / network)
            errors += 1
            results.append(
                {"alertId": alert_id, "amount": amount, "status": "error", "error": str(e)}
            )
            log.warning("Auto-fine failed for alert %s: %s", alert_id, e)

    summary = {
        "enabled": True,
        "candidates": len(targets),
        "fined": fined,
        "errors": errors,
        "results": results,
    }
    log.info("Auto-fine sweep complete: %s", summary)
    return summary
