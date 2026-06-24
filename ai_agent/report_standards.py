"""Air-quality reporting standards reference.

The AeroSense sensors measure particulate matter only (PM2.5, PM10) — not CO,
SO2, NO2 or O3 — so a composite Air Quality Index (which requires those
sub-indices) is NOT computed. Instead, measured PM concentrations are assessed
directly against:
  - Vietnam QCVN 05:2023/BTNMT national ambient limits (the legal standard), and
  - the WHO 2021 Global Air Quality Guidelines (the stricter health reference).

This mirrors how regulators (US EPA, EU AAQD) report particulate exceedances
against fixed concentration limits, just without rolling them into an index.
Sources: QCVN 05:2023/BTNMT (Bảng 1); WHO 2021 AQG.
"""
from __future__ import annotations

# WHO 2021 guideline values (µg/m³) — health-based reference, not a legal limit.
WHO_2021 = {
    "pm2.5": {"annual": 5, "daily": 15},
    "pm10": {"annual": 15, "daily": 45},
}

# Vietnam QCVN 05:2023/BTNMT national ambient air quality limits (µg/m³), Bảng 1.
# Note: the PM2.5 24-hour limit steps down from 50 to 45 µg/m³ effective
# 01 Jan 2026 — 45 is in force for the platform's current period.
QCVN_2023 = {
    "pm2.5": {"annual": 25, "daily": 45},
    "pm10": {"annual": 50, "daily": 100},
}


def assess(pm_type: str, value: float | None) -> dict:
    """Assess a PM concentration (µg/m³, period average) against the 24-hour limits.

    Returns {status, qcvn_daily, who_daily, exceeds_qcvn, exceeds_who, advisory}.
    status is one of: 'Within guidelines', 'Above WHO guideline',
    'Exceeds national limit', or 'N/A' when there's no value.
    """
    key = (pm_type or "").lower()
    if value is None or key not in QCVN_2023:
        return {"status": "N/A", "advisory": "No data available.",
                "qcvn_daily": None, "who_daily": None,
                "exceeds_qcvn": None, "exceeds_who": None}

    qcvn = QCVN_2023[key]["daily"]
    who = WHO_2021[key]["daily"]
    exceeds_qcvn = value > qcvn
    exceeds_who = value > who

    if exceeds_qcvn:
        status = "Exceeds national limit"
        advisory = ("Above Vietnam's QCVN 05:2023 24-hour limit — a regulatory "
                    "exceedance; sensitive groups should limit outdoor exposure.")
    elif exceeds_who:
        status = "Above WHO guideline"
        advisory = ("Within the national limit but above the WHO 2021 guideline — "
                    "a residual health concern for prolonged exposure.")
    else:
        status = "Within guidelines"
        advisory = "Within both the national limit and the WHO guideline."

    return {
        "status": status,
        "advisory": advisory,
        "qcvn_daily": qcvn,
        "who_daily": who,
        "exceeds_qcvn": exceeds_qcvn,
        "exceeds_who": exceeds_who,
    }


# Short narrative the report embeds in its methodology appendix.
STANDARDS_OVERVIEW = """\
This report assesses particulate-matter concentrations only (PM2.5 and PM10); \
the monitoring network does not measure CO, SO2, NO2 or O3, so no composite Air \
Quality Index is calculated. Measured period-average concentrations are compared \
directly against Vietnam's national ambient air quality standard QCVN \
05:2023/BTNMT (24-hour limits: PM2.5 45 µg/m³ (effective 1 Jan 2026), PM10 100 \
µg/m³) and, as a stricter health reference, the World Health Organization 2021 \
Global Air Quality Guidelines (24-hour: PM2.5 15 µg/m³, PM10 45 µg/m³). A reading \
above the QCVN limit is flagged as a regulatory exceedance; a reading within the \
QCVN limit but above the WHO guideline is flagged as a residual health concern. \
This concentration-versus-limit approach mirrors the particulate-exceedance \
reporting used under the US EPA NAAQS and the EU Ambient Air Quality Directive."""
