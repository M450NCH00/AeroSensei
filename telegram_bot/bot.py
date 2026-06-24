"""AeroSense Telegram bot — two-way chat with the AI agent + push notifications.

Runs as a single process with two halves:

  1. CHAT (long polling): pulls updates from Telegram with getUpdates (an OUTBOUND
     call), so it needs no public IP / inbound port and works fine on localhost.
     Each allow-listed message is forwarded to the AI agent's /ask endpoint with a
     short-lived JWT the bot mints itself (signed with the shared JWT_SECRET), and
     the agent's reply is sent back to the chat.

  2. PUSH (Flask /notify): a small INTERNAL HTTP endpoint other services (backend,
     a cron job, the agent) can POST to in order to broadcast a message to the
     subscribed chats — e.g. "sensor X breached PM2.5" or "fine issued to Y".

Why this shape:
  * Decoupled — the bot never imports the agent or touches a DB; it speaks HTTP to
    the agent and mints its own token, exactly like the web frontend does.
  * localhost now, AWS later — everything is env-driven. On AWS this becomes a
    task/service; only the env values change. (To switch CHAT to webhooks on AWS,
    swap the poll loop for setWebhook + a route — the rest is unchanged.)

Required env:
  TELEGRAM_BOT_TOKEN     BotFather token (REQUIRED).
  JWT_SECRET             MUST match the backend/agent secret.
Optional env (with defaults):
  AI_AGENT_URL           http://ai-agent:5001   (the agent's /ask base URL)
  AGENT_EMAIL            government@example.com  (subject of the minted token)
  AGENT_ROLES            GOVERNMENT              (csv; must intersect the agent's allowed roles)
  TELEGRAM_ALLOWED_CHAT_IDS  (csv of numeric chat ids allowed to chat / receive pushes)
  NOTIFY_SECRET          (shared secret required in the X-Notify-Secret header)
  NOTIFY_PORT            5002
  AGENT_TIMEOUT          120   (seconds to wait for an agent answer)
  POLL_TIMEOUT           30    (Telegram long-poll seconds)
  HISTORY_TURNS          6     (per-chat context turns kept in memory)
"""
import logging
import os
import threading
import time
from collections import defaultdict, deque

import jwt
import requests
from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("telegram-bot")


def _split(v: str) -> list[str]:
    return [s.strip() for s in (v or "").split(",") if s.strip()]


# --- Config ---
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
JWT_SECRET = os.getenv("JWT_SECRET", "your-hackathon-super-secret-key-xyz123")
AI_AGENT_URL = os.getenv("AI_AGENT_URL", "http://ai-agent:5001").rstrip("/")
AGENT_EMAIL = os.getenv("AGENT_EMAIL", "government@example.com")
AGENT_ROLES = _split(os.getenv("AGENT_ROLES", "GOVERNMENT")) or ["GOVERNMENT"]
ALLOWED_CHAT_IDS = set(_split(os.getenv("TELEGRAM_ALLOWED_CHAT_IDS", "")))
NOTIFY_SECRET = os.getenv("NOTIFY_SECRET", "").strip()
NOTIFY_PORT = int(os.getenv("NOTIFY_PORT", "5002"))
AGENT_TIMEOUT = float(os.getenv("AGENT_TIMEOUT", "120"))
POLL_TIMEOUT = int(os.getenv("POLL_TIMEOUT", "30"))
HISTORY_TURNS = int(os.getenv("HISTORY_TURNS", "6"))

TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"
TG_MSG_LIMIT = 4096  # Telegram hard limit per message.

# Per-chat rolling history (in-memory; fine for a single instance).
_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=HISTORY_TURNS * 2))


# --- JWT: mint a short-lived token the agent + backend accept ---
def mint_token() -> str:
    now = int(time.time())
    payload = {
        "sub": AGENT_EMAIL,
        "roles": AGENT_ROLES,
        "permissions": [],
        "iat": now,
        "exp": now + 60 * 30,  # 30 min; minted fresh per request anyway.
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# --- Telegram helpers ---
def tg(method: str, **params):
    resp = requests.post(f"{TG_API}/{method}", json=params, timeout=POLL_TIMEOUT + 10)
    resp.raise_for_status()
    return resp.json()


def send_message(chat_id, text: str):
    """Send text to a chat, chunked to Telegram's per-message limit."""
    text = text or "(empty response)"
    for i in range(0, len(text), TG_MSG_LIMIT):
        try:
            tg("sendMessage", chat_id=chat_id, text=text[i:i + TG_MSG_LIMIT])
        except requests.RequestException as e:
            log.warning("sendMessage failed for chat %s: %s", chat_id, e)


def is_allowed(chat_id: str) -> bool:
    # Empty allow-list = fail closed (nobody can chat) but we still tell callers
    # their chat id so an admin can add it to TELEGRAM_ALLOWED_CHAT_IDS.
    return chat_id in ALLOWED_CHAT_IDS


# --- Chat: ask the agent and reply ---
def ask_agent(question: str, chat_id: str) -> str:
    hist = list(_history[chat_id])
    try:
        resp = requests.post(
            f"{AI_AGENT_URL}/ask",
            headers={"Authorization": f"Bearer {mint_token()}", "Content-Type": "application/json"},
            json={"question": question, "messages": hist},
            timeout=AGENT_TIMEOUT,
        )
        if resp.status_code != 200:
            return f"⚠️ The assistant returned an error (HTTP {resp.status_code})."
        answer = (resp.json() or {}).get("answer") or "I couldn't produce an answer."
    except requests.RequestException as e:
        log.warning("agent call failed: %s", e)
        return "⚠️ I couldn't reach the AI agent. Please check the service is running."

    # Record the turn for follow-up context.
    _history[chat_id].append({"role": "user", "content": question})
    _history[chat_id].append({"role": "assistant", "content": answer})
    return answer


def handle_message(msg: dict):
    chat = msg.get("chat", {})
    chat_id = str(chat.get("id"))
    text = (msg.get("text") or "").strip()
    if not chat_id or not text:
        return

    if text.lower() in ("/start", "/help"):
        allowed = is_allowed(chat_id)
        send_message(chat_id,
            "AeroSense regulator assistant.\n\n"
            f"Your chat id is: {chat_id}\n"
            + ("You're authorized — just send me a question (e.g. \"Which companies "
               "exceeded their allowance in 2025?\").\nUse /reset to clear context."
               if allowed else
               "You are NOT authorized yet. Ask an admin to add this chat id to "
               "TELEGRAM_ALLOWED_CHAT_IDS and restart the bot."))
        return

    if not is_allowed(chat_id):
        send_message(chat_id, f"Not authorized. Your chat id is {chat_id} — give it to an admin to allow-list.")
        log.info("rejected message from non-allowlisted chat %s", chat_id)
        return

    if text.lower() == "/reset":
        _history.pop(chat_id, None)
        send_message(chat_id, "Context cleared.")
        return

    # Show a typing indicator while the agent works, then reply.
    try:
        tg("sendChatAction", chat_id=chat_id, action="typing")
    except requests.RequestException:
        pass
    send_message(chat_id, ask_agent(text, chat_id))


def poll_loop():
    log.info("chat poll loop started (allow-listed chats: %s)", sorted(ALLOWED_CHAT_IDS) or "<none>")
    offset = None
    while True:
        try:
            params = {"timeout": POLL_TIMEOUT}
            if offset is not None:
                params["offset"] = offset
            data = tg("getUpdates", **params)
            for update in data.get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message") or update.get("edited_message")
                if msg:
                    try:
                        handle_message(msg)
                    except Exception:
                        log.exception("error handling update %s", update.get("update_id"))
        except requests.RequestException as e:
            log.warning("getUpdates failed: %s (retrying)", e)
            time.sleep(3)
        except Exception:
            log.exception("unexpected error in poll loop")
            time.sleep(3)


# --- Push: internal /notify endpoint ---
app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "allowlisted_chats": len(ALLOWED_CHAT_IDS)}), 200


@app.route("/notify", methods=["POST"])
def notify():
    """Broadcast a message to subscribed chats.

    Auth: X-Notify-Secret header must equal NOTIFY_SECRET (if NOTIFY_SECRET is set).
    Body: { "text": "...", "chat_ids": ["123"] }  -- chat_ids optional; defaults to
    all allow-listed chats. Any requested chat id must still be allow-listed.
    """
    if NOTIFY_SECRET and request.headers.get("X-Notify-Secret") != NOTIFY_SECRET:
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Field 'text' is required"}), 400

    requested = set(str(c) for c in (data.get("chat_ids") or [])) or ALLOWED_CHAT_IDS
    targets = [c for c in requested if is_allowed(c)]
    for chat_id in targets:
        send_message(chat_id, f"🔔 {text}")
    return jsonify({"sent": len(targets)}), 200


def main():
    if not BOT_TOKEN:
        log.error("TELEGRAM_BOT_TOKEN is not set. Get one from @BotFather and set it. Exiting.")
        raise SystemExit(1)
    # Chat poll loop in the background; Flask /notify in the foreground.
    threading.Thread(target=poll_loop, daemon=True).start()
    log.info("notify endpoint listening on :%d", NOTIFY_PORT)
    app.run(host="0.0.0.0", port=NOTIFY_PORT)


if __name__ == "__main__":
    main()
