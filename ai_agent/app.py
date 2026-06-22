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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
