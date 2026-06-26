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

import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

import agent
import config
from auth import AuthError, authenticate

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

app = Flask(__name__)

# Allow credentials so the browser sends the httpOnly accessToken cookie.
_allowed_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
CORS(app, resources={r"/*": {"origins": _allowed_origin}}, supports_credentials=True)


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
