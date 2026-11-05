# AeroSense Telegram Bot

Two capabilities in one small service:

1. **Chat** — message the bot and it answers via the AeroSense AI agent (same
   tools/skills as the web assistant, including company sector classification).
2. **Push** — other services POST to an internal `/notify` endpoint to broadcast
   alerts (sensor breaches, fines, etc.) to subscribed chats.

```text
Telegram  ──getUpdates (outbound)──►  bot  ──/ask + Bearer JWT──►  AI agent ──► backend
   ▲                                   │
   └────────── sendMessage ◄───────────┘
Internal service ──POST /notify (X-Notify-Secret)──► bot ──► broadcast to chats
```

## Why this works on localhost (and ports to AWS)

Chat uses **long polling**: the bot makes *outbound* calls to `api.telegram.org`,
so it needs no public IP, no inbound port, no tunnel. The only requirement is
outbound internet access. Push is a plain internal HTTP endpoint.

Everything is env-driven, so the localhost → AWS move is a config change. On AWS
you can keep long polling as-is, or switch chat to **webhooks** (Telegram pushes
to a public HTTPS URL) by replacing the poll loop with `setWebhook` + a Flask
route — the agent/notify halves are unchanged. Move secrets to AWS Secrets
Manager / SSM at that point.

## Setup

1. **Create a bot**: message [@BotFather](https://t.me/BotFather) → `/newbot` →
   copy the token.
2. **Configure**: create `.env` next to `docker-compose.yml` (compose auto-loads it):
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-your-token
   NOTIFY_SECRET=some-long-random-string
   TELEGRAM_ALLOWED_CHAT_IDS=
   ```
3. **Start it**: `docker compose up -d telegram-bot`
4. **Authorize yourself**: open your bot in Telegram, send `/start`. It replies
   with your numeric **chat id**. Add it to `TELEGRAM_ALLOWED_CHAT_IDS` (comma-sep
   for multiple), then `docker compose up -d telegram-bot` to reload.
5. Send a question, e.g. *"Which companies have no sector assigned?"*

## Sending a push notification

Any internal service can broadcast to all allow-listed chats:

```bash
curl -X POST http://telegram-bot:5002/notify \
  -H "Content-Type: application/json" \
  -H "X-Notify-Secret: $NOTIFY_SECRET" \
  -d '{"text": "CRITICAL: sensor SPS30-12 PM2.5 = 78 µg/m³ at Hanoi site"}'
```

Optional `"chat_ids": ["123","456"]` targets specific chats (still must be
allow-listed). To call it from the host, uncomment the `ports:` mapping for
`telegram-bot` in `docker-compose.yml` and use `http://localhost:5002`.

To wire a real trigger (e.g. when the backend issues a fine or detects a breach),
have that code POST to `/notify` — no bot code changes needed.

## Config reference

| Var | Default | Notes |
|-----|---------|-------|
| `TELEGRAM_BOT_TOKEN` | — | **Required.** From @BotFather. |
| `JWT_SECRET` | — | **Must match** the backend/agent secret. |
| `TELEGRAM_ALLOWED_CHAT_IDS` | empty | CSV of chat ids allowed to chat / receive pushes. Empty = nobody (fail closed). |
| `AI_AGENT_URL` | `http://ai-agent:5001` | Agent base URL. |
| `AGENT_EMAIL` | `government@example.com` | Subject of the minted token (a seeded gov user). |
| `AGENT_ROLES` | `GOVERNMENT` | CSV; must intersect the agent's `AGENT_ALLOWED_ROLES`. |
| `NOTIFY_SECRET` | empty | Shared secret for `/notify`. Empty = endpoint unauthenticated (set one!). |
| `NOTIFY_PORT` | `5002` | Port for `/health` + `/notify`. |
| `AGENT_TIMEOUT` | `120` | Seconds to wait for an agent answer. |
| `POLL_TIMEOUT` | `30` | Telegram long-poll seconds. |
| `HISTORY_TURNS` | `6` | Per-chat context turns kept in memory. |

## Notes & limitations

- Chat history is in-memory per instance — fine for one container; use a shared
  store if you run multiple replicas.
- Set a strong `NOTIFY_SECRET`. Without one, anything that can reach the container
  on `:5002` could broadcast messages.
- The minted token carries `AGENT_ROLES`, so Telegram users effectively act with
  that role. Keep the allow-list tight.
