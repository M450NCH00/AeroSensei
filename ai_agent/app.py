"""Flask entrypoint for the AeroSense regulator AI assistant.

Exposes:
  GET  /health  -> liveness probe
  POST /ask     -> authenticated, tool-calling agent turn

Auth: the caller's accessToken cookie (issued by the backend) is verified and
the role checked (ADMIN-only for now). The same token is forwarded to the
backend on every tool call.
"""
import logging
import os
import time

import requests
from flask import Flask, Response, jsonify, request

import agent
import config
from auth import AuthError, authenticate

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

# When a CITY-WIDE escalation fires, individual per-site Telegram alerts become
# redundant noise and (with every site breached) flood Telegram into 429 rate
# limits. While this window is active, /alert skips the per-site Telegram push;
# the single city-wide summary covers it. Refreshed on each /ministry-alert.
_city_wide_suppress_until = 0.0

app = Flask(__name__)

# CORS is handled entirely by the nginx reverse proxy (see nginx.conf's /agent/
# location). Enforcing a localhost-only allowlist here 403'd real deployment
# origins (e.g. the EC2 public DNS) and duplicated the Access-Control-* headers.


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "provider": config.LLM_PROVIDER, "model": config.LLM_MODEL}), 200


@app.route("/ask", methods=["POST"])
def ask():
    # 1. Authenticate + authorize the caller.
    try:
        token, claims = authenticate(request)
    except AuthError as e:
        return jsonify({"error": str(e)}), e.status

    # 2. Validate input.
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "Field 'question' is required"}), 400
    history = data.get("messages") or []

    # 3. Run the agent loop.
    try:
        answer = agent.run(question, history, token)
    except Exception:
        log.exception("Agent failed for user=%s", claims.get("sub"))
        return jsonify({"error": "The assistant encountered an internal error."}), 500

    return jsonify({"answer": answer})


@app.route("/reports/<path:filename>", methods=["GET"])
def get_report(filename):
    """Serve a generated PDF report, streamed from MinIO.

    The report tool stores PDFs in MinIO with unguessable random filenames and
    returns this URL to the user, who downloads it directly from the browser.
    """
    if not filename.endswith(".pdf") or "/" in filename:
        return jsonify({"error": "not found"}), 404
    import storage
    data = storage.get_report(filename)
    if data is None:
        return jsonify({"error": "Report not found or expired."}), 404
    return Response(
        data,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.route("/backups", methods=["GET"])
def list_backups():
    """List historical-data backup files (government/admin only).

    Returns the objects in the MinIO backups bucket that the weekly cron writes,
    for the frontend's Historical Data tab. Auth: same JWT + role gate as /ask.
    """
    try:
        authenticate(request)
    except AuthError as e:
        return jsonify({"error": str(e)}), e.status
    import storage
    return jsonify({"backups": storage.list_backups()}), 200


@app.route("/backups/download", methods=["GET"])
def download_backup():
    """Stream a single backup file for download (government/admin only).

    Query param `key` is the object key from GET /backups. Auth: same as /ask.
    """
    try:
        authenticate(request)
    except AuthError as e:
        return jsonify({"error": str(e)}), e.status

    key = (request.args.get("key") or "").strip()
    # Keys come from our own listing; reject anything trying to escape the bucket path.
    if not key or key.startswith("/") or ".." in key:
        return jsonify({"error": "invalid or missing 'key'"}), 400

    import storage
    data = storage.get_backup(key)
    if data is None:
        return jsonify({"error": "Backup not found."}), 404

    filename = key.rsplit("/", 1)[-1]
    return Response(
        data,
        mimetype="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.route("/backups/run", methods=["POST"])
def run_backup():
    """Trigger an on-demand backup of the current window (up to now).

    Authorized either by a government/admin JWT (the 'Backup now' button) or by
    the internal secret (so a scheduler could call it too). Returns the created
    archive's metadata, or a 'no data' message when the window is empty.
    """
    authorized = False
    if config.INTERNAL_API_SECRET and request.headers.get("X-Internal-Secret") == config.INTERNAL_API_SECRET:
        authorized = True
    else:
        try:
            authenticate(request)
            authorized = True
        except AuthError as e:
            return jsonify({"error": str(e)}), e.status
    if not authorized:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    lookback = data.get("lookback_days")
    try:
        import backup
        result = backup.run_backup(lookback_days=int(lookback) if lookback is not None else None)
    except Exception:
        log.exception("On-demand backup failed")
        return jsonify({"error": "Backup failed."}), 500

    if result.get("status") == "empty":
        return jsonify({"status": "empty", "message": "No data in the selected window."}), 200
    return jsonify(result), 201


@app.route("/alert", methods=["POST"])
def alert():
    """Internal: backend triggers a Telegram air-quality alert.

    Called server-to-server by the backend after it persists a pm_alerts row. The
    backend POSTs the full row; the agent composes a short advisory (LLM, with a
    deterministic fallback) and forwards it to the Telegram bot's /notify push
    endpoint.

    Auth: X-Internal-Secret header must equal INTERNAL_API_SECRET. If that secret
    is unset, the endpoint is disabled (fail closed).

    Body (JSON) — mirrors the pm_alerts table:
      id               (optional)  the row id
      sensor_id        (optional, string)
      site_name        (optional, string)  human-readable site, e.g. 'VPBank'
      pm_type          (optional, string)  'pm2.5' | 'pm10'
      measured_value   (required, number)  the breaching reading
      threshold_value  (optional, number)
      alert_level      (optional, string)  'warning' | 'critical'
      triggered_at     (optional)
      resolved_at      (optional)
      note             (optional, string)
      chat_ids         (optional, list)    specific allow-listed chats; defaults to all
    """
    # 1. Authenticate the internal caller.
    if not config.INTERNAL_API_SECRET:
        return jsonify({"error": "Alert endpoint is disabled (INTERNAL_API_SECRET not set)."}), 503
    if request.headers.get("X-Internal-Secret") != config.INTERNAL_API_SECRET:
        return jsonify({"error": "forbidden"}), 403

    # 2. Validate input — a pm_alerts row needs at least the measured value.
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get("measured_value"), (int, float)):
        return jsonify({"error": "Field 'measured_value' (number) is required"}), 400

    # 2b. If a city-wide escalation is active, skip the per-site Telegram push to
    # avoid flooding Telegram (429). The city-wide summary already went out.
    if time.time() < _city_wide_suppress_until:
        return jsonify({"status": "suppressed", "reason": "city-wide escalation active"}), 200

    # 3. Compose the advisory message.
    try:
        message = agent.compose_alert(data)
    except Exception:
        log.exception("Failed to compose alert")
        return jsonify({"error": "Failed to compose alert message."}), 500

    # 4. Push it to the Telegram bot.
    headers = {"Content-Type": "application/json"}
    if config.TELEGRAM_NOTIFY_SECRET:
        headers["X-Notify-Secret"] = config.TELEGRAM_NOTIFY_SECRET
    payload = {"text": message}
    if data.get("chat_ids"):
        payload["chat_ids"] = data["chat_ids"]

    try:
        resp = requests.post(
            config.TELEGRAM_NOTIFY_URL,
            json=payload,
            headers=headers,
            timeout=config.TELEGRAM_NOTIFY_TIMEOUT,
        )
    except requests.RequestException as e:
        log.warning("telegram notify failed: %s", e)
        return jsonify({"error": "Could not reach the Telegram notifier.", "message": message}), 502

    if resp.status_code != 200:
        log.warning("telegram notify returned HTTP %s: %s", resp.status_code, resp.text)
        return jsonify({"error": f"Telegram notifier returned HTTP {resp.status_code}.",
                        "message": message}), 502

    sent = (resp.json() or {}).get("sent")
    return jsonify({"status": "sent", "recipients": sent, "message": message}), 200


@app.route("/ministry-alert", methods=["POST"])
def ministry_alert():
    """Internal: city-wide escalation — email tailored directives to ministries.

    Called server-to-server by the backend when a large share of Hanoi's live
    sensors are unhealthy. The backend has already decided the level; this
    endpoint composes a per-ministry directive and emails it (or logs it when
    SMTP is unconfigured).

    Auth: X-Internal-Secret must equal INTERNAL_API_SECRET (fail closed).

    Body (JSON):
      level            (required)  'WARNING' | 'BREACHED'
      total_sensors    (optional, int)
      warning_sensors  (optional, int)
      breached_sensors (optional, int)
      warning_pct      (optional, number)
      breached_pct     (optional, number)
    """
    if not config.INTERNAL_API_SECRET:
        return jsonify({"error": "Ministry-alert endpoint is disabled (INTERNAL_API_SECRET not set)."}), 503
    if request.headers.get("X-Internal-Secret") != config.INTERNAL_API_SECRET:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    level = str(data.get("level") or "").strip().upper()
    if level not in ("WARNING", "BREACHED"):
        return jsonify({"error": "Field 'level' must be 'WARNING' or 'BREACHED'"}), 400

    # A city-wide event is now in effect: suppress redundant per-site Telegram
    # alerts for a window (refreshed on each escalation) so Telegram isn't flooded.
    global _city_wide_suppress_until
    _city_wide_suppress_until = time.time() + config.CITY_WIDE_SUPPRESS_MINUTES * 60

    # On a BREACHED (city-wide) escalation, research likely reasons the whole city
    # is polluted. Token-light + cached; never blocks the alert if it fails.
    causes = None
    if level == "BREACHED" and config.POLLUTION_RESEARCH_ENABLED:
        try:
            import pollution_research
            causes = pollution_research.get_pollution_causes(data)
        except Exception:
            log.exception("Pollution cause research failed (continuing without it)")

    try:
        import ministry
        result = ministry.send_ministry_alerts(level, data, causes=causes)
    except Exception:
        log.exception("Failed to send ministry alerts")
        return jsonify({"error": "Failed to send ministry alerts."}), 500

    # Also push a city-wide alert to Telegram (both WARNING and BREACHED), including
    # the web-research causes when present. Non-fatal: never break the response.
    try:
        tg = ministry.push_city_telegram(level, data, causes)
        if tg:
            result["telegram"] = tg
    except Exception:
        log.exception("City-wide Telegram push failed (continuing)")

    return jsonify(result), 200


@app.route("/ministry-alerts", methods=["GET"])
def ministry_alerts_list():
    """Read-only feed of recent city-wide escalation broadcasts for the UI.

    Each broadcast carries the level, timestamp, sensor stats, and the composed
    per-ministry email drafts (receiver + subject + body). For the demo these
    are displayed instead of being emailed.
    """
    import ministry
    return jsonify({"broadcasts": ministry.get_recent_broadcasts()}), 200


@app.route("/site-alert", methods=["POST"])
def site_alert():
    """Internal: per-site company alert.

    The backend posts a site's current WARNING/BREACHED state (or SAFE to clear
    on recovery). The agent stores it with templated MOH advice for the owning
    company, surfaced on the Alerts page.

    Auth: X-Internal-Secret must equal INTERNAL_API_SECRET (fail closed).

    Body (JSON):
      site_id       (required)
      site_name     (optional, string)
      company_name  (optional, string)
      level         (required)  'WARNING' | 'BREACHED' | 'SAFE'
      pm2_5, pm10   (optional, number)
    """
    if not config.INTERNAL_API_SECRET:
        return jsonify({"error": "Site-alert endpoint is disabled (INTERNAL_API_SECRET not set)."}), 503
    if request.headers.get("X-Internal-Secret") != config.INTERNAL_API_SECRET:
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    site_id = data.get("site_id")
    if site_id is None:
        return jsonify({"error": "Field 'site_id' is required"}), 400
    level = str(data.get("level") or "").strip().upper()
    if level not in ("WARNING", "BREACHED", "SAFE"):
        return jsonify({"error": "Field 'level' must be 'WARNING', 'BREACHED', or 'SAFE'"}), 400

    import ministry
    if level == "SAFE":
        ministry.clear_site_alert(site_id)
        return jsonify({"status": "cleared", "site_id": site_id}), 200

    alert = ministry.upsert_site_alert(
        site_id,
        data.get("site_name") or f"Site {site_id}",
        data.get("company_name") or "",
        level,
        data.get("pm2_5"),
        data.get("pm10"),
    )
    return jsonify({"status": "ok", "alert": alert}), 200


@app.route("/site-alerts/clear", methods=["POST"])
def site_alerts_clear():
    """Internal: drop all per-site alerts (used when the demo resets to normal)."""
    if not config.INTERNAL_API_SECRET:
        return jsonify({"error": "disabled (INTERNAL_API_SECRET not set)."}), 503
    if request.headers.get("X-Internal-Secret") != config.INTERNAL_API_SECRET:
        return jsonify({"error": "forbidden"}), 403
    import ministry
    ministry.clear_all_site_alerts()
    return jsonify({"status": "cleared"}), 200


@app.route("/alerts", methods=["GET"])
def alerts_feed():
    """Unified read-only feed for the Alerts page: per-site company alerts and
    city-wide department escalations."""
    import ministry
    return jsonify({
        "site_alerts": ministry.get_site_alerts(),
        "city_alerts": ministry.get_recent_broadcasts(),
    }), 200


def _match_sector(summary: dict, sectors: list) -> tuple:
    """Best-effort map of the researcher's free-text suggestion to a real sector id.

    Returns (sectorId, sectorName) or (None, "") when nothing matches — the human
    picks/overrides in the UI either way.
    """
    candidates = [summary.get("suggested_sector") or "", summary.get("industry") or ""]
    names = [(s.get("id"), str(s.get("name") or "")) for s in (sectors or [])]
    norm = [(sid, name, name.lower()) for sid, name in names if name]
    # 1. exact, then 2. substring either direction, then 3. token overlap.
    for cand in candidates:
        cl = cand.strip().lower()
        if not cl:
            continue
        for sid, name, nl in norm:
            if nl == cl:
                return sid, name
    for cand in candidates:
        cl = cand.strip().lower()
        if not cl:
            continue
        for sid, name, nl in norm:
            if cl in nl or nl in cl:
                return sid, name
    for cand in candidates:
        ctoks = {t for t in cand.lower().split() if len(t) > 2}
        for sid, name, nl in norm:
            if ctoks & set(nl.split()):
                return sid, name
    return None, ""


@app.route("/classify/preview", methods=["POST"])
def classify_preview():
    """Research a company and PREVIEW a sector suggestion — without writing anything.

    Powers the human-in-the-loop classification page: the regulator sees what the
    isolated web researcher found and a suggested sector, then confirms or corrects
    it. The actual assignment is a separate, explicit PATCH the frontend makes.

    Auth: same as /ask (the caller's accessToken cookie, ADMIN/GOVERNMENT).
    """
    try:
        token, _claims = authenticate(request)
    except AuthError as e:
        return jsonify({"error": str(e)}), e.status

    data = request.get_json(silent=True) or {}
    company_name = (data.get("companyName") or "").strip()
    if not company_name:
        return jsonify({"error": "Field 'companyName' is required"}), 400

    try:
        import research_agent
        import tools
        summary = research_agent.research_company(company_name)
        suggested_id, suggested_name = None, ""
        try:
            sectors = tools._backend_get("/api/sectors", {}, token) or []
            suggested_id, suggested_name = _match_sector(summary, sectors)
        except Exception:
            log.exception("sector matching failed for %s", company_name)
        return jsonify({
            "summary": summary,
            "suggestedSectorId": suggested_id,
            "suggestedSectorName": suggested_name,
        }), 200
    except Exception:
        log.exception("classify preview failed for %s", company_name)
        return jsonify({"error": "Classification preview failed."}), 500


@app.route("/enforce", methods=["POST"])
def enforce():
    """Internal: autonomously fine every BREACHED, un-fined PM alert.

    Called server-to-server by the backend's nightly PM-breach check after it
    writes new pm_alerts rows. Auth mirrors /alert: the caller must present
    X-Internal-Secret == INTERNAL_API_SECRET, and the endpoint is disabled (fail
    closed) when that secret is unset. The actual fining is additionally gated by
    ENFORCEMENT_AUTO_FINE, so the endpoint is safe even if reachable.
    """
    if not config.INTERNAL_API_SECRET:
        return jsonify({"error": "Enforce endpoint is disabled (INTERNAL_API_SECRET not set)."}), 503
    if request.headers.get("X-Internal-Secret") != config.INTERNAL_API_SECRET:
        return jsonify({"error": "forbidden"}), 403

    import enforcement
    try:
        summary = enforcement.run_auto_fine_sweep()
    except Exception:
        log.exception("Auto-fine enforcement sweep failed")
        return jsonify({"error": "Enforcement sweep failed."}), 500
    return jsonify(summary), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
