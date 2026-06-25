# AI Agent Backend — Regulator Assistant

A tool-calling agent that acts as the personal assistant of a government
regulator/admin. It answers questions by calling the existing Spring Boot
backend's read-only endpoints (which wrap Postgres + InfluxDB), so all auth,
role checks, and business logic stay in the backend. The agent generates no SQL
and holds no database credentials.

```text
Regulator (Frontend)
  │  POST /ask { question, messages[] }  + accessToken cookie
  ▼
Flask AI Agent (this project)
  │  - verifies JWT, requires ADMIN role
  │  - LLM tool-calling loop (provider-agnostic)
  ▼
LLM provider:  Ollama (now)  │  AWS Bedrock (future, configurable)
  │  tool calls
  ▼
Spring Boot backend  ──►  Postgres + InfluxDB   (forwards the SAME cookie)
  ▲
  └─ results fed back to the LLM → final answer → Frontend
```

## Code layout

| File | Role |
|------|------|
| `app.py` | Flask routes (`/health`, `/ask`, `/classify/preview`, internal `/alert` + `/enforce`), auth gate |
| `auth.py` | Verify JWT (HS256) + role; mint a system token for autonomous enforcement |
| `agent.py` | The main (write-capable) tool-calling loop |
| `tools.py` | Tool wrappers: backend GETs, the `research_company` delegate, and the writes (sector-assign, issue-fine) |
| `research_agent.py` | **Isolated** company researcher: ingests untrusted web text in its own write-free context, returns a structured summary |
| `enforcement.py` | Autonomous sweep: auto-issue fines for BREACHED, un-fined alerts |
| `research.py` | Open-web search + page fetch (key-free) with an SSRF guard |
| `skills.py` | Task playbooks that chain tools (rendered into the system prompt) |
| `providers/` | Pluggable LLM backends (`ollama_provider`, `bedrock_provider` stub) |
| `config.py` | All env-driven configuration |
| `knowledge_base.py` | System prompt incl. tool-use rules |

## Configuration (env vars)

| Var | Default | Notes |
|-----|---------|-------|
| `LLM_PROVIDER` | `ollama` | `ollama` or `bedrock` |
| `LLM_MODEL` | `qwen2.5:7b-instruct` | **Must be tool-capable.** `qwen3:0.6b` will NOT work. |
| `OLLAMA_HOST` | `http://host.docker.internal:11434` | |
| `BACKEND_BASE_URL` | `http://backend:8081` | Tool execution target |
| `JWT_SECRET` | — | **Must match the backend's `JWT_SECRET`** |
| `AGENT_ALLOWED_ROLES` | `ADMIN` | Comma-separated roles allowed to use the agent |
| `LLM_MAX_TOOL_ITERATIONS` | `5` | Max LLM↔tool round trips |
| `WEB_TIMEOUT` | `15` | Timeout (s) for web search / page fetch |
| `WEB_MAX_RESULTS` | `5` | Max web-search results returned to the model |
| `WEB_FETCH_MAX_CHARS` | `6000` | Cap on fetched page text (protects the context window) |

## Company research & sector classification

The agent can research what a company does on the open web and allocate it to an
industry sector — but the untrusted-web step is **quarantined** from the
write-capable agent:

- `research_company` — the only web-facing tool the main agent sees. It delegates
  to an **isolated researcher** (`research_agent.py`) that runs in its own context
  with *only* `web_search` / `fetch_company_page` (key-free DuckDuckGo + page-text
  extraction, SSRF-guarded in `research.py`) and **no token and no write tools**.
  The researcher returns a fixed-shape, length-capped JSON summary
  (`business_activity`, `industry`, `products`, `suggested_sector`,
  `evidence_urls`, `confidence`, `notes`). The main agent never sees raw page text,
  so a prompt injection on a company's page can't reach a write — it's a structural
  boundary, not just a prompt instruction.
- `assign_company_sector` — a **write** tool; `PATCH /api/sectors/companies/{id}`
  with `{sectorId}`. The backend re-checks the caller's ADMIN/GOVERNMENT role on the
  forwarded cookie. (The agent also has `issue_fine`; see *Autonomous enforcement*.)

The *Company sector classification* skill chains these: `list_companies` +
`list_sectors` → `research_company` → verify + pick the best-matching sector →
assign. Example:

```bash
curl -X POST http://localhost:5001/ask \
  -H "Content-Type: application/json" -b "accessToken=<JWT>" \
  -d '{"question": "Research what VinSteel does and assign it to the right sector"}'
```

> The default `qwen3:0.6b` from the old setup cannot do reliable tool calling.
> Pull a tool-capable model: `ollama pull qwen2.5:7b-instruct`
> (or `llama3.1:8b` / `mistral-nemo`, depending on your hardware).

---

# Installing Ollama

## Windows

Download from:

https://ollama.com/download

Install normally.

Verify installation:

```bash
ollama --version
```

---

## Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verify:

```bash
ollama --version
```

---

## macOS

Download from:

https://ollama.com/download

Verify:

```bash
ollama --version
```

---

# Pulling a Model

```bash
ollama pull qwen3:0.6b
```

or

```bash
ollama pull qwen3:1.7b
```

# Starting Ollama

Start Ollama server:

```bash
ollama serve
```

Default endpoint:

```text
http://localhost:11434
```

Leave this terminal running.

---

# Setting Up Python Environment

Install dependencies:

```bash
pip install flask ollama
```

---

# Testing Ollama Connection

```bash
python test.py
```

# Running the Flask Server

Start:

```bash
python app.py
```

Expected output:

```text
Running on http://0.0.0.0:5001
```

Server endpoint:

```text
http://<IP_ADDRESS>:5001
```

---

# API Specification

## Ask Question

```http
POST /ask
```

Requires authentication: the backend-issued `accessToken` cookie (or an
`Authorization: Bearer <jwt>` header for testing). The caller must hold the
`ADMIN` role.

Request:

```json
{
  "question": "Which companies exceeded their carbon allowance in 2025?",
  "messages": [
    { "role": "user", "content": "previous question" },
    { "role": "assistant", "content": "previous answer" }
  ]
}
```

`messages` (prior turns) is optional. Responses:

```json
{ "answer": "..." }            // 200
{ "error": "Missing authentication token" }   // 401
{ "error": "Access denied: ... restricted to ['ADMIN']" }  // 403
```

---

# Frontend Integration Notes

Must send `credentials: "include"` so the browser forwards the httpOnly
`accessToken` cookie to the agent:

```javascript
fetch(`${AI_AGENT_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ question: "<QUESTION>", messages: history })
})
.then(res => res.json())
.then(data => console.log(data.answer));
```

---

# Testing with curl

```bash
# Grab an admin accessToken cookie from a login, then:
curl -X POST http://localhost:5001/ask \
  -H "Content-Type: application/json" \
  -b "accessToken=<JWT>" \
  -d '{"question": "List all companies and their carbon balances"}'
```
