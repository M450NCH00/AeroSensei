"""City-wide ministry escalation: compose and email directives per ministry.

When a large share of Hanoi's sensors turn unhealthy, the backend calls
POST /ministry-alert with a level (WARNING or BREACHED) and the sensor stats.
This module turns that into a tailored email per ministry — each ministry gets a
different directive for each level (e.g. Education: WARNING -> ban outdoor
activities; BREACHED -> cancel classes).

Delivery is via SMTP (config.SMTP_*). If SMTP_HOST is unset, emails are LOGGED
instead of sent, so the whole flow is testable without mail credentials.
"""
import logging
import re
import smtplib
import threading
import uuid
from collections import deque
from datetime import datetime, timezone
from email.mime.text import MIMEText

import requests

import config

log = logging.getLogger("ministry")

# In-memory store of recent escalation broadcasts, newest last. For the demo we
# don't send real email — the UI reads these drafts (subject/body + receiver)
# from GET /ministry-alerts. Capped so the process can't grow unbounded.
_BROADCASTS = deque(maxlen=int(getattr(config, "MINISTRY_HISTORY_MAX", 20)))
_LOCK = threading.Lock()


def get_recent_broadcasts() -> list:
    """Return stored broadcasts, newest first (for the UI)."""
    with _LOCK:
        return list(reversed(_BROADCASTS))

# Each ministry: a stable key, display name, contact email, and the action it
# should take at each escalation level. Emails/addresses are examples — override
# per deployment, or set MINISTRY_TEST_RECIPIENT to funnel them all to one inbox.
MINISTRIES = [
    {
        "key": "education",
        "name": "Ministry of Education and Training",
        "email": "contact@moet.gov.vn",
        "warning": "Instruct all schools to suspend outdoor activities and physical-education "
                   "classes, keep students indoors with windows closed, and move assemblies inside.",
        "breached": "Cancel in-person classes for kindergartens and primary schools, switch to "
                    "online learning where possible, and close all school playgrounds and sports fields.",
    },
    {
        "key": "health",
        "name": "Ministry of Health",
        "email": "contact@moh.gov.vn",
        "warning": "Issue a public respiratory-health advisory, distribute N95 masks, and put "
                   "hospitals on alert for a rise in asthma and cardiopulmonary cases.",
        "breached": "Activate the emergency respiratory response: open additional clinics, "
                    "prioritise vulnerable groups (children, elderly, pregnant women, chronic patients), "
                    "and advise the public to remain indoors.",
    },
    {
        "key": "transport",
        "name": "Ministry of Transport",
        "email": "contact@mt.gov.vn",
        "warning": "Encourage public-transport use, increase road cleaning and dust suppression, "
                   "and prepare contingency traffic-reduction measures.",
        "breached": "Impose odd-even private-vehicle restrictions and ban heavy diesel trucks from "
                    "the inner city for the duration of the episode.",
    },
    {
        "key": "industry",
        "name": "Ministry of Industry and Trade",
        "email": "contact@moit.gov.vn",
        "warning": "Request high-emission factories and power plants to reduce output and defer "
                   "non-essential production.",
        "breached": "Order temporary shutdown or load reduction of the most polluting industrial "
                    "facilities until air quality recovers.",
    },
    {
        "key": "labour",
        "name": "Ministry of Labour, Invalids and Social Affairs",
        "email": "contact@molisa.gov.vn",
        "warning": "Advise employers to shorten outdoor work shifts and provide masks to all "
                   "outdoor workers.",
        "breached": "Suspend outdoor construction and manual-labour work, with paid stoppage for "
                    "exposed workers.",
    },
    {
        "key": "agriculture",
        "name": "Ministry of Agriculture and Rural Development",
        "email": "contact@mard.gov.vn",
        "warning": "Halt agricultural-residue and straw burning in and around the city.",
        "breached": "Enforce a strict ban on all open burning and dispatch inspectors to "
                    "peri-urban farming areas.",
    },
    {
        "key": "environment",
        "name": "Ministry of Natural Resources and Environment",
        "email": "contact@monre.gov.vn",
        "warning": "Intensify air-quality monitoring, publish hourly AQI updates, and pre-position "
                   "response teams.",
        "breached": "Declare an air-quality emergency, coordinate the inter-ministerial response, "
                    "and identify major emission sources for immediate enforcement.",
    },
    {
        "key": "construction",
        "name": "Ministry of Construction",
        "email": "contact@moc.gov.vn",
        "warning": "Enforce dust-control measures at all construction sites (covering, water "
                   "spraying, wheel washing).",
        "breached": "Halt construction and demolition activities that generate dust until the "
                    "episode clears.",
    },
    {
        "key": "culture_sports_tourism",
        "name": "Ministry of Culture, Sports and Tourism",
        "email": "contact@bvhttdl.gov.vn",
        "warning": "Advise organisers to postpone large outdoor events and outdoor sports competitions.",
        "breached": "Cancel outdoor public events, festivals, and sporting activities, and close "
                    "open-air tourist attractions.",
    },
]


def _stats_line(stats: dict) -> str:
    total = stats.get("total_sensors")
    warn = stats.get("warning_sensors")
    breach = stats.get("breached_sensors")
    warn_pct = stats.get("warning_pct")
    breach_pct = stats.get("breached_pct")
    return (
        f"Live sensors reporting: {total}. "
        f"WARNING-or-worse: {warn} of {total} ({warn_pct}%). "
        f"BREACHED: {breach} of {total} ({breach_pct}%)."
    )


def compose_email(ministry: dict, level: str, stats: dict) -> tuple[str, str]:
    """Return (subject, body) for one ministry at the given level."""
    level = level.upper()
    action = ministry["breached" if level == "BREACHED" else "warning"]
    headline = (
        "CRITICAL — hazardous air quality across Hanoi"
        if level == "BREACHED"
        else "WARNING — unhealthy air quality across Hanoi"
    )
    subject = f"[AeroSense] {level}: Hanoi air quality — action required ({ministry['name']})"
    body = (
        f"{headline}\n\n"
        f"{_stats_line(stats)}\n\n"
        f"A city-wide air-quality escalation has been triggered because at least half of Hanoi's "
        f"live air-quality sensors are in the {level} state.\n\n"
        f"Required action for the {ministry['name']}:\n"
        f"  {action}\n\n"
        f"This is an automated alert from the AeroSense air-quality monitoring platform. "
        f"Please coordinate with the Ministry of Natural Resources and Environment on the "
        f"joint response.\n"
    )
    return subject, body


def _send_via_smtp(server, recipient: str, subject: str, body: str) -> None:
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = config.SMTP_FROM
    msg["To"] = recipient
    server.sendmail(config.SMTP_FROM, [recipient], msg.as_string())


def send_ministry_alerts(level: str, stats: dict, causes: dict | None = None) -> dict:
    """Compose a directive per ministry, store it for the UI, and (if SMTP is
    configured) also email it.

    For the demo, SMTP is left unconfigured: the drafts are stored and surfaced
    in the UI via GET /ministry-alerts instead of being sent. Returns the stored
    broadcast (id, level, timestamp, stats, causes, drafts) plus a delivery summary.

    `causes` (optional) is the web-research finding on why the whole city is
    polluted, attached to the broadcast for the UI (BREACHED escalations only).
    """
    level = level.upper()

    drafts = []
    for m in MINISTRIES:
        subject, body = compose_email(m, level, stats)
        drafts.append({
            "ministry": m["name"],
            "recipient": config.MINISTRY_TEST_RECIPIENT or m["email"],
            "subject": subject,
            "body": body,
        })

    # Only actually send when SMTP is configured AND email is enabled.
    delivery = "drafted"  # demo default: not sent, shown in UI
    sent, failed = 0, 0
    if config.MINISTRY_EMAIL_ENABLED and config.SMTP_HOST:
        delivery = "sent"
        try:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=config.SMTP_TIMEOUT)
            if config.SMTP_USE_TLS:
                server.starttls()
            with server:
                if config.SMTP_USER:
                    server.login(config.SMTP_USER, config.SMTP_PASSWORD)
                for d in drafts:
                    try:
                        _send_via_smtp(server, d["recipient"], d["subject"], d["body"])
                        sent += 1
                    except Exception as e:
                        failed += 1
                        log.error("Ministry email FAILED -> %s <%s>: %s", d["ministry"], d["recipient"], e)
        except Exception:
            log.exception("SMTP connection failed; ministry emails not sent (drafts still stored)")
            delivery, failed = "failed", len(drafts)
    else:
        log.warning("MINISTRY ESCALATION [%s] drafted for %d ministries (demo mode — not emailed).",
                    level, len(drafts))

    broadcast = {
        "id": uuid.uuid4().hex[:12],
        "level": level,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total_sensors": stats.get("total_sensors"),
            "warning_sensors": stats.get("warning_sensors"),
            "breached_sensors": stats.get("breached_sensors"),
            "warning_pct": stats.get("warning_pct"),
            "breached_pct": stats.get("breached_pct"),
        },
        "delivery": delivery,
        "causes": causes,
        "drafts": drafts,
    }
    with _LOCK:
        _BROADCASTS.append(broadcast)

    return {"status": "ok", "delivery": delivery, "sent": sent, "failed": failed,
            "broadcast_id": broadcast["id"], "ministries": len(drafts)}


# --- Telegram broadcast for city-wide escalations ------------------------------

def _strip_md(text: str) -> str:
    """Flatten the LLM's markdown (bold/bullets) into Telegram-friendly plain text."""
    lines = []
    for ln in text.splitlines():
        s = ln.strip().replace("**", "")
        s = re.sub(r"^[-*]\s+", "• ", s)
        lines.append(s)
    return "\n".join(lines).strip()


def compose_city_telegram(level: str, stats: dict, causes: dict | None = None) -> str:
    """Build the city-wide Telegram alert text (plain, with the causes when present)."""
    level = level.upper()
    icon = "🔴" if level == "BREACHED" else "⚠️"
    total = stats.get("total_sensors")
    breached = stats.get("breached_sensors")
    breach_pct = stats.get("breached_pct")
    warn_pct = stats.get("warning_pct")

    parts = [
        f"{icon} CITY-WIDE AIR QUALITY: {level}",
        f"{config.CITY_NAME} — {breached}/{total} sensors breached ({breach_pct}%); "
        f"warning-or-worse {warn_pct}%.",
        f"Directives issued to {len(MINISTRIES)} ministries (Education, Health, Transport, ...).",
    ]

    if causes and causes.get("reasons"):
        parts.append("")
        parts.append("Possible causes (web research):")
        parts.append(_strip_md(str(causes["reasons"]))[:1500])
        sources = causes.get("sources") or []
        titles = [s.get("title", "").strip() for s in sources[:3] if s.get("title")]
        if titles:
            parts.append("Sources: " + " | ".join(t[:45] for t in titles))

    return "\n".join(parts)[:3800]  # keep under Telegram's 4096-char limit


def push_city_telegram(level: str, stats: dict, causes: dict | None = None) -> dict | None:
    """Push the city-wide escalation to the Telegram bot's /notify endpoint.

    Fire-and-forget: a failure here must never break the ministry-alert response.
    """
    text = compose_city_telegram(level, stats, causes)
    headers = {"Content-Type": "application/json"}
    if config.TELEGRAM_NOTIFY_SECRET:
        headers["X-Notify-Secret"] = config.TELEGRAM_NOTIFY_SECRET
    try:
        resp = requests.post(
            config.TELEGRAM_NOTIFY_URL,
            json={"text": text},
            headers=headers,
            timeout=config.TELEGRAM_NOTIFY_TIMEOUT,
        )
        if resp.status_code != 200:
            log.warning("city telegram notify returned HTTP %s: %s", resp.status_code, resp.text)
            return {"telegram": "failed", "status_code": resp.status_code}
        return {"telegram": "sent", "recipients": (resp.json() or {}).get("sent")}
    except requests.RequestException as e:
        log.warning("city telegram notify failed: %s", e)
        return {"telegram": "unreachable"}
