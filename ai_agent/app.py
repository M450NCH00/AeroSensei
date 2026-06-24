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
from flask import Flask, jsonify, request
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
