"""Comprehensive air-quality report generation (PDF).

Given a target (a company or a single site) and an optional timeline, this:
  1. gathers data from the backend (company, sites, time-series PM history,
     breach alerts, fines) — each source degrades gracefully if unavailable,
  2. assesses PM readings against Vietnam's QCVN 05:2023 limits and WHO guidelines,
  3. asks the LLM for an executive summary + recommendations grounded in the data,
  4. renders a PDF and returns a download URL served by the agent.

All backend calls forward the caller's JWT (gov-scoped), so authorization stays
enforced by the backend.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

import config
import report_standards
import tools

log = logging.getLogger("reporting")


class ReportError(Exception):
    """Raised when a report can't be produced (e.g. target not found)."""


# --- date helpers ---------------------------------------------------------

def _parse_date(s) -> datetime | None:
    if not s:
        return None
    text = str(s).strip().replace("Z", "+00:00")
    for parse in (
        lambda t: datetime.fromisoformat(t),
        lambda t: datetime.strptime(t, "%Y-%m-%d"),
    ):
        try:
            dt = parse(text)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue
    return None


def _in_window(ts, start: datetime | None, end: datetime | None) -> bool:
    dt = _parse_date(ts)
    if dt is None:
        return True  # keep records we can't date rather than silently drop them
    if start and dt < start:
        return False
    if end and dt > end:
        return False
    return True


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# --- backend gathering (resilient) ---------------------------------------

def _safe_get(path: str, token: str):
    try:
        data = tools._backend_get(path, {}, token)
        return data if data is not None else []
    except Exception as e:
        log.warning("report data fetch failed for %s: %s", path, e)
        return []


def _resolve_target(target_type: str, name: str, token: str) -> dict:
    """Resolve a company or site name into {company_name, sites:[{id,name}]}."""
    companies = _safe_get("/api/companies", token) or []
    name_l = (name or "").strip().lower()

    if target_type == "company":
        match = next((c for c in companies if (c.get("companyName") or "").lower() == name_l), None) \
            or next((c for c in companies if name_l and name_l in (c.get("companyName") or "").lower()), None)
        if not match:
            raise ReportError(f"No company found matching '{name}'.")
        sites = _safe_get(f"/api/companies/{match['id']}/sites", token) or []
        return {
            "company_name": match.get("companyName"),
            "company_id": match.get("id"),
            "sites": [{"id": s.get("id"), "name": s.get("siteName")} for s in sites],
        }

    # target_type == "site": search every company's sites for a name match.
    for c in companies:
        sites = _safe_get(f"/api/companies/{c['id']}/sites", token) or []
        for s in sites:
            sn = (s.get("siteName") or "").lower()
            if sn == name_l or (name_l and name_l in sn):
                return {
                    "company_name": c.get("companyName"),
                    "company_id": c.get("id"),
                    "sites": [{"id": s.get("id"), "name": s.get("siteName")}],
                }
    raise ReportError(f"No site found matching '{name}'.")


def _site_stats(site: dict, start, end, token: str) -> dict:
    """Per-site PM2.5/PM10 aggregates + limit assessment over the window."""
    history = _safe_get(f"/api/sensors/site/{site['id']}/history", token) or []
    rows = [h for h in history if _in_window(h.get("timestamp"), start, end)]

    def agg(field):
        vals = [_num(r.get(field)) for r in rows]
        vals = [v for v in vals if v is not None]
        if not vals:
            return None, None
        return sum(vals) / len(vals), max(vals)

    pm25_avg, pm25_max = agg("pm25")
    pm10_avg, pm10_max = agg("pm10")
    return {
        "site_id": site["id"],
        "site_name": site["name"],
        "readings": len(rows),
        "pm25_avg": pm25_avg,
        "pm25_max": pm25_max,
        "pm10_avg": pm10_avg,
        "pm10_max": pm10_max,
        "pm25_assess": report_standards.assess("pm2.5", pm25_avg),
        "pm10_assess": report_standards.assess("pm10", pm10_avg),
    }


def _gather(target_type: str, name: str, start, end, token: str) -> dict:
    target = _resolve_target(target_type, name, token)
    site_ids = {s["id"] for s in target["sites"]}
    company_name_l = (target["company_name"] or "").lower()

    site_stats = [_site_stats(s, start, end, token) for s in target["sites"]]

    def belongs(rec):
        if rec.get("siteId") in site_ids:
            return True
        return (rec.get("companyName") or "").lower() == company_name_l

    alerts = [a for a in (_safe_get("/api/alerts", token) or [])
              if belongs(a) and _in_window(a.get("triggeredAt"), start, end)]
    fines = [f for f in (_safe_get("/api/alerts/fines", token) or [])
             if belongs(f) and _in_window(f.get("issuedAt"), start, end)]

    return {
        "target_type": target_type,
        "company_name": target["company_name"],
        "sites": target["sites"],
        "site_stats": site_stats,
        "alerts": alerts,
        "fines": fines,
        "start": start,
        "end": end,
    }


# --- LLM narrative --------------------------------------------------------

def _facts_text(facts: dict) -> str:
    lines = [f"Company: {facts['company_name']}",
             f"Sites covered: {', '.join(s['name'] for s in facts['sites']) or 'none'}"]
    for s in facts["site_stats"]:
        lines.append(
            f"- {s['site_name']}: {s['readings']} readings; "
            f"PM2.5 avg={_fmt(s['pm25_avg'])} max={_fmt(s['pm25_max'])} µg/m³ "
            f"({s['pm25_assess']['status']}); "
            f"PM10 avg={_fmt(s['pm10_avg'])} max={_fmt(s['pm10_max'])} µg/m³ "
            f"({s['pm10_assess']['status']})"
        )
    lines.append(f"Breach alerts in period: {len(facts['alerts'])} "
                 f"({sum(1 for a in facts['alerts'] if str(a.get('alertLevel','')).upper()=='BREACHED')} BREACHED)")
    total_fines = sum(_num(f.get("amount")) or 0 for f in facts["fines"])
    lines.append(f"Fines in period: {len(facts['fines'])} totalling {total_fines:.2f}")
    return "\n".join(lines)


def _narrative(facts: dict) -> str:
    """LLM-written executive summary + recommendations grounded in the facts."""
    period = _period_label(facts["start"], facts["end"])
    try:
        provider = config.get_provider()
        messages = [
            {"role": "system", "content": (
                "You are an environmental compliance analyst for a Vietnamese air-quality "
                "regulator. Write the narrative for an official report in plain prose (no "
                "markdown headers). Produce exactly two short sections separated by a blank "
                "line: first an 'Executive Summary' paragraph (3-5 sentences) of the air-"
                "quality and compliance posture; then a 'Recommendations' paragraph (2-4 "
                "sentences) of concrete regulatory actions. The network measures only "
                "particulate matter (PM2.5, PM10) — do NOT mention or imply any overall air "
                "quality index. Compare concentrations against Vietnam's QCVN 05:2023 "
                "24-hour limits (PM2.5 45, PM10 100 µg/m³) and the WHO 2021 guidelines "
                "(PM2.5 15, PM10 45 µg/m³). Use ONLY the data provided; do not invent numbers."
            )},
            {"role": "user", "content": (
                f"Reporting period: {period}\n\nData:\n{_facts_text(facts)}\n\n"
                "Write the Executive Summary and Recommendations now."
            )},
        ]
        text = (provider.chat(messages, tools=[]).text or "").strip()
        if text:
            return text
    except Exception:
        log.exception("LLM narrative failed; using deterministic fallback")

    n_breached = sum(1 for a in facts["alerts"] if str(a.get("alertLevel", "")).upper() == "BREACHED")
    n_exceed = sum(1 for s in facts["site_stats"]
                   if s["pm25_assess"].get("exceeds_qcvn") or s["pm10_assess"].get("exceeds_qcvn"))
    return (
        f"Executive Summary: This report covers {facts['company_name']} over {period}. "
        f"{len(facts['site_stats'])} site(s) had PM2.5/PM10 concentrations assessed against "
        f"Vietnam's QCVN 05:2023 limits and WHO 2021 guidelines; {n_exceed} site(s) exceeded "
        f"the national limit. {len(facts['alerts'])} PM-breach alert(s) ({n_breached} at "
        f"BREACHED level) and {len(facts['fines'])} fine(s) were recorded in the period.\n\n"
        "Recommendations: Prioritise sites exceeding the QCVN 24-hour limit, ensure all "
        "BREACHED alerts have been adjudicated, and verify outstanding fines are settled."
    )


# --- formatting helpers ---------------------------------------------------

def _fmt(v, dp=1):
    return f"{v:.{dp}f}" if isinstance(v, (int, float)) else "—"


def _period_label(start, end) -> str:
    if start and end:
        return f"{start.date()} to {end.date()}"
    if start:
        return f"since {start.date()}"
    if end:
        return f"up to {end.date()}"
    return "all available data"


# --- PDF rendering --------------------------------------------------------

def _render_pdf(facts: dict, narrative: str, path: str) -> None:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    NAVY = colors.HexColor("#005A8C")
    TEAL = colors.HexColor("#009B9E")
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=NAVY, fontSize=20, spaceAfter=4)
    sub = ParagraphStyle("sub", parent=styles["Normal"], textColor=colors.grey, fontSize=10, spaceAfter=12)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=TEAL, fontSize=13, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9.5, leading=14)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=7.5, textColor=colors.grey, leading=10)

    doc = SimpleDocTemplate(path, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=16 * mm, rightMargin=16 * mm,
                            title="AeroSense Air Quality Report")
    el = []

    el.append(Paragraph("Air Quality &amp; Compliance Report", h1))
    scope = facts["company_name"] or "—"
    if facts["target_type"] == "site" and facts["sites"]:
        scope += f" — {facts['sites'][0]['name']}"
    el.append(Paragraph(f"{scope} &nbsp;·&nbsp; {_period_label(facts['start'], facts['end'])}", sub))

    meta = [
        ["Generated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")],
        ["Prepared by", "AeroSense AI Assistant"],
        ["Pollutants measured", "PM2.5, PM10 (particulate matter only)"],
        ["Assessment basis", "QCVN 05:2023/BTNMT 24-hour limits"],
        ["Health reference", "WHO Global Air Quality Guidelines 2021"],
    ]
    mt = Table(meta, colWidths=[40 * mm, None])
    mt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), NAVY),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#EEEEEE")),
    ]))
    el.append(mt)

    # Executive summary / recommendations (LLM prose; split paragraphs on blank lines).
    el.append(Paragraph("Executive Summary &amp; Recommendations", h2))
    for para in [p.strip() for p in narrative.split("\n\n") if p.strip()]:
        el.append(Paragraph(para.replace("\n", "<br/>"), body))
        el.append(Spacer(1, 4))

    # Particulate-matter assessment table (concentration vs. limits).
    el.append(Paragraph("Particulate Matter Assessment", h2))
    aq_header = ["Site", "PM2.5 avg", "max", "vs limit", "PM10 avg", "max", "vs limit", "Readings"]
    aq_rows = [aq_header]
    for s in facts["site_stats"]:
        aq_rows.append([
            s["site_name"] or "—",
            _fmt(s["pm25_avg"]), _fmt(s["pm25_max"]), s["pm25_assess"]["status"],
            _fmt(s["pm10_avg"]), _fmt(s["pm10_max"]), s["pm10_assess"]["status"],
            str(s["readings"]),
        ])
    if len(aq_rows) == 1:
        aq_rows.append(["No time-series data for the period", "", "", "", "", "", "", ""])
    el.append(_grid(aq_rows, NAVY))
    el.append(Paragraph(
        "Concentrations in µg/m³ (period average). 'vs limit' is the period-average "
        "assessment against the reference limits below.", small))

    # Reference limits used for the assessment (pulled from report_standards so the
    # table always matches the thresholds actually applied).
    el.append(Paragraph("Reference Limits (µg/m³)", h2))
    ref_rows = [["Pollutant", "QCVN 05:2023 — 24-hour", "QCVN 05:2023 — annual",
                 "WHO 2021 — 24-hour", "WHO 2021 — annual"]]
    for key, label in (("pm2.5", "PM2.5"), ("pm10", "PM10")):
        q = report_standards.QCVN_2023[key]
        w = report_standards.WHO_2021[key]
        ref_rows.append([label, str(q["daily"]), str(q["annual"]),
                         str(w["daily"]), str(w["annual"])])
    el.append(_grid(ref_rows, TEAL))
    el.append(Paragraph(
        "QCVN 05:2023/BTNMT is Vietnam's national ambient limit (the legal standard); "
        "WHO 2021 is the stricter health-based guideline. The PM2.5 24-hour limit of "
        "45 µg/m³ is effective 1 Jan 2026 (previously 50).", small))

    # Breach alerts.
    el.append(Paragraph(f"PM Breach Alerts ({len(facts['alerts'])})", h2))
    if facts["alerts"]:
        rows = [["Site", "Type", "Measured", "Threshold", "Level", "Triggered", "Fined"]]
        for a in facts["alerts"]:
            rows.append([
                a.get("siteName") or "—", (a.get("pmType") or "").upper(),
                _fmt(_num(a.get("measuredValue"))), _fmt(_num(a.get("thresholdValue"))),
                a.get("alertLevel") or "—", _short_ts(a.get("triggeredAt")),
                "Yes" if a.get("fined") else "No",
            ])
        el.append(_grid(rows, NAVY))
    else:
        el.append(Paragraph("No breach alerts recorded in this period.", body))

    # Fines.
    total_fines = sum(_num(f.get("amount")) or 0 for f in facts["fines"])
    el.append(Paragraph(f"Fines ({len(facts['fines'])} · total {total_fines:,.2f})", h2))
    if facts["fines"]:
        rows = [["Site", "Amount", "Status", "Reason", "Issued"]]
        for f in facts["fines"]:
            rows.append([
                f.get("siteName") or "—", _fmt(_num(f.get("amount")), 2),
                f.get("status") or "—", _truncate(f.get("reason"), 60), _short_ts(f.get("issuedAt")),
            ])
        el.append(_grid(rows, NAVY))
    else:
        el.append(Paragraph("No fines issued in this period.", body))

    # Methodology.
    el.append(Paragraph("Methodology &amp; Standards", h2))
    el.append(Paragraph(report_standards.STANDARDS_OVERVIEW.replace("\n", " "), body))
    el.append(Spacer(1, 10))
    el.append(Paragraph(
        "This report was generated automatically by the AeroSense AI Assistant from "
        "platform data. Figures should be verified against source records before use in "
        "formal enforcement proceedings.", small))

    doc.build(el)


def _grid(rows, header_color):
    from reportlab.lib import colors
    from reportlab.platypus import Table, TableStyle
    t = Table(rows, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F8FB")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#DDDDDD")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def _short_ts(ts):
    dt = _parse_date(ts)
    return dt.strftime("%Y-%m-%d %H:%M") if dt else "—"


def _truncate(s, n):
    s = str(s or "—")
    return s if len(s) <= n else s[: n - 1] + "…"


# --- public entry point ---------------------------------------------------

def generate_report(args: dict, token: str) -> dict:
    """Build a PDF report and return a download URL + summary for the agent.

    args: target_type ('company'|'site'), name, from_date, to_date (optional).
    """
    target_type = (args.get("target_type") or "company").lower()
    if target_type not in ("company", "site"):
        target_type = "company"
    name = (args.get("name") or "").strip()
    if not name:
        raise ReportError("A company or site name is required to generate a report.")
    start = _parse_date(args.get("from_date"))
    end = _parse_date(args.get("to_date"))

    facts = _gather(target_type, name, start, end, token)
    narrative = _narrative(facts)

    # Render to memory, then persist to MinIO (streamed back via GET /reports/<file>).
    import io
    import storage
    buffer = io.BytesIO()
    _render_pdf(facts, narrative, buffer)
    filename = f"aqr_{uuid.uuid4().hex[:12]}.pdf"
    storage.upload_report(filename, buffer.getvalue())

    total_fines = sum(_num(f.get("amount")) or 0 for f in facts["fines"])
    return {
        "report_url": f"{config.AGENT_PUBLIC_URL}/reports/{filename}",
        "company": facts["company_name"],
        "period": _period_label(start, end),
        "sites_covered": len(facts["sites"]),
        "alerts_in_period": len(facts["alerts"]),
        "fines_in_period": len(facts["fines"]),
        "total_fine_amount": round(total_fines, 2),
        "note": "Give the user the report_url as a clickable download link.",
    }
