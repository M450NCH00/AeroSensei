"""Central configuration loaded from environment variables.

Everything that differs between local (Ollama) and the future AWS (Bedrock)
deployment is driven from here so the rest of the code stays provider-agnostic.
"""
import os


def _split(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


# --- LLM provider selection ---
# Which backend drives the tool-calling loop: "ollama", "bedrock", or "litellm"
# (a unified OpenAI-style gateway to OpenAI/Anthropic/Bedrock/Azure/Gemini/etc.).
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()

# Model id. For Ollama this MUST be a tool-capable model (e.g. qwen2.5:7b-instruct,
# llama3.1:8b, mistral-nemo). The default qwen3:0.6b cannot tool-call reliably.
# For litellm, this is a LiteLLM model id, e.g. "gpt-4o-mini",
# "anthropic/claude-3-5-sonnet-20241022", or "ollama/qwen2.5:7b-instruct".
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b-instruct")

# Ollama server endpoint.
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")

# LiteLLM (used only when LLM_PROVIDER=litellm). Optional overrides; most backends
# also read their own provider env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, ...).
LITELLM_API_BASE = os.getenv("LITELLM_API_BASE", "")
LITELLM_API_KEY = os.getenv("LITELLM_API_KEY", "")

# Context window (max input tokens) for the model. 0 = leave to LiteLLM's defaults.
# Needed for models LiteLLM doesn't know (e.g. self-hosted), so token counting and
# context-window checks work; also sets Ollama's num_ctx when routing via ollama.
LLM_CONTEXT_WINDOW = int(os.getenv("LLM_CONTEXT_WINDOW", "0"))

# Bedrock (used only when LLM_PROVIDER=bedrock). Region + model id read here so
# the migration is a config change, not a code change.
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")

# DeepSeek (used only when LLM_PROVIDER=deepseek). Connects DIRECTLY to DeepSeek's
# OpenAI-compatible, tool-calling API — no LiteLLM. Supply DEEPSEEK_API_KEY through
# the environment (.env). Default model: "deepseek-v4-flash".
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash").strip()
DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com").strip()
DEEPSEEK_TIMEOUT = float(os.getenv("DEEPSEEK_TIMEOUT", "60"))

# Max LLM<->tool round trips before we force a final answer.
MAX_TOOL_ITERATIONS = int(os.getenv("LLM_MAX_TOOL_ITERATIONS", "5"))

# Max round trips for the ISOLATED company researcher (research_agent.py). Kept
# small: its only job is to read a few pages and emit a structured summary.
RESEARCH_MAX_ITERATIONS = int(os.getenv("RESEARCH_MAX_ITERATIONS", "4"))

# --- Backend (tool execution target) ---
# The agent calls the Spring Boot backend's existing endpoints; the backend owns
# all auth, role checks, and business logic over Postgres + InfluxDB.
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://backend:8081").rstrip("/")
BACKEND_TIMEOUT = float(os.getenv("BACKEND_TIMEOUT", "20"))

# --- Web research (open-web search + page fetch for sector classification) ---
WEB_TIMEOUT = float(os.getenv("WEB_TIMEOUT", "15"))
WEB_MAX_RESULTS = int(os.getenv("WEB_MAX_RESULTS", "5"))
# Cap fetched page text so a huge page can't blow past the model's context window.
WEB_FETCH_MAX_CHARS = int(os.getenv("WEB_FETCH_MAX_CHARS", "6000"))

# --- City-wide pollution cause research (on BREACHED escalations) ---
# When >=50% of sensors breach, web-search likely reasons the whole city's PM is
# high. Token-saving by design: snippets only (no page fetches), a small result
# cap, a tight single LLM summarization, and a cache so repeat triggers within the
# window reuse the same finding instead of re-searching + re-summarizing.
CITY_NAME = os.getenv("CITY_NAME", "Hanoi").strip()
POLLUTION_RESEARCH_ENABLED = os.getenv("POLLUTION_RESEARCH_ENABLED", "true").strip().lower() in (
    "1", "true", "yes", "on",
)
POLLUTION_RESEARCH_MAX_RESULTS = int(os.getenv("POLLUTION_RESEARCH_MAX_RESULTS", "8"))
# Max total web searches per investigation: an initial search plus LLM-chosen
# follow-ups that chase leads from earlier results. Capped to bound token/time cost.
POLLUTION_RESEARCH_MAX_SEARCHES = int(os.getenv("POLLUTION_RESEARCH_MAX_SEARCHES", "5"))
# Hard cap on snippet chars fed to the LLM — the main token lever.
POLLUTION_RESEARCH_MAX_CHARS = int(os.getenv("POLLUTION_RESEARCH_MAX_CHARS", "3000"))
# Recency filter for the search: d/w/m/y (past day/week/month/year) or "" for none.
# Default: past month, so causes reflect the current episode, not years-old articles.
POLLUTION_RESEARCH_TIME_FILTER = os.getenv("POLLUTION_RESEARCH_TIME_FILTER", "m").strip()
# Cooldown between web-scrape investigations (seconds; default 30 min). While a
# breach persists, repeat escalations within this window reuse the last finding
# instead of scraping again; once it lapses and the city is still breaching, a
# fresh investigation runs. (Old env name kept as a fallback for compatibility.)
POLLUTION_RESEARCH_COOLDOWN_SECONDS = int(os.getenv(
    "POLLUTION_RESEARCH_COOLDOWN_SECONDS",
    os.getenv("POLLUTION_RESEARCH_CACHE_SECONDS", "1800"),
))

# --- Auth ---
# Shared HS256 secret used by the backend to sign JWTs. The agent verifies the
# caller's token with the same secret. MUST match the backend's JWT_SECRET.
JWT_SECRET = os.getenv("JWT_SECRET", "your-hackathon-super-secret-key-xyz123")

# Roles permitted to use the agent. Admin-only for now.
ALLOWED_ROLES = {r.upper() for r in _split(os.getenv("AGENT_ALLOWED_ROLES", "ADMIN"))}

# --- Internal alerting (backend -> agent -> telegram) ---
# Shared secret the backend must present (X-Internal-Secret header) to trigger an
# alert. Empty = the endpoint is disabled (fail closed) so it can't be abused.
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "").strip()

# Whether the Telegram PM alert is phrased by the LLM. OFF by default: the alert is
# built from structured fields (site, pm type, measured vs threshold, level), so the
# deterministic template is instant, free, and can't be delayed or mangled by the
# model. Set ALERT_USE_LLM=true to let the LLM rephrase it (same template as fallback).
ALERT_USE_LLM = os.getenv("ALERT_USE_LLM", "false").strip().lower() in ("1", "true", "yes", "on")

# Telegram bot's internal push endpoint and its shared secret (NOTIFY_SECRET on
# the bot side). The agent POSTs the composed alert here to broadcast it.
TELEGRAM_NOTIFY_URL = os.getenv("TELEGRAM_NOTIFY_URL", "http://telegram-bot:5002/notify").rstrip("/")
TELEGRAM_NOTIFY_SECRET = os.getenv("TELEGRAM_NOTIFY_SECRET", "").strip()
TELEGRAM_NOTIFY_TIMEOUT = float(os.getenv("TELEGRAM_NOTIFY_TIMEOUT", "15"))
# While a city-wide escalation is active, suppress per-site Telegram alerts for
# this many minutes so the flood of individual site alerts doesn't 429 Telegram.
CITY_WIDE_SUPPRESS_MINUTES = float(os.getenv("CITY_WIDE_SUPPRESS_MINUTES", "30"))

# Sites exempt from the city-wide suppression above — their per-site Telegram
# alerts ALWAYS fire (e.g. the physical VinUniversity sensor we actively monitor).
# Comma-separated, case-insensitive substring match against the alert's site_name.
ALERT_SUPPRESS_EXEMPT_SITES = [
    s.strip().lower()
    for s in os.getenv("ALERT_SUPPRESS_EXEMPT_SITES", "VinUniversity").split(",")
    if s.strip()
]

# --- PDF report generation ---
# Generated PDFs are stored in MinIO (S3) and streamed back via GET /reports/<file>.
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
MINIO_REPORTS_BUCKET = os.getenv("MINIO_REPORTS_BUCKET", "reports")
# Bucket where the InfluxDB->MinIO backup stores compressed historical data.
# Government users list + download these via the Historical Data tab, and trigger
# an on-demand "Backup now" that reads InfluxDB directly.
MINIO_BACKUPS_BUCKET = os.getenv("MINIO_BACKUPS_BUCKET", "influx-backups")

# InfluxDB source for the on-demand "Backup now" (mirrors the scheduled cron).
INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086").rstrip("/")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "my-super-secret-admin-token-12345")
INFLUX_ORG = os.getenv("INFLUX_ORG", "my-org")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "sensors_data")
# Default window (days) for on-demand backups: 1 = the last day up to now.
BACKUP_LOOKBACK_DAYS = int(os.getenv("BACKUP_LOOKBACK_DAYS", "1"))
# Public base URL of this agent, used to build absolute download links the
# browser can open. Matches the frontend's NEXT_PUBLIC_AI_AGENT_URL.
AGENT_PUBLIC_URL = os.getenv("AGENT_PUBLIC_URL", "http://localhost:5001").rstrip("/")

# --- Autonomous enforcement (agent auto-issues fines for BREACHED alerts) ---
# Auto-fining is a consequential WRITE with no human in the loop, so it is OFF by
# default and must be explicitly enabled. When on, the nightly PM check (or any
# internal caller of POST /enforce) makes the agent fine every BREACHED, un-fined
# alert.
ENFORCEMENT_AUTO_FINE = os.getenv("ENFORCEMENT_AUTO_FINE", "false").strip().lower() in (
    "1", "true", "yes", "on",
)

# Identity the agent assumes when issuing fines autonomously. It mints a
# short-lived JWT with this subject/role from the shared JWT_SECRET; the backend
# records it as the fine's issued_by, so the audit trail shows the AI agent acted.
# The role MUST satisfy the backend's hasAnyRole('GOVERNMENT','ADMIN') on the fine
# endpoint.
ENFORCEMENT_SYSTEM_EMAIL = os.getenv("ENFORCEMENT_SYSTEM_EMAIL", "ai-agent@aerosensei.system")
ENFORCEMENT_ROLE = os.getenv("ENFORCEMENT_ROLE", "GOVERNMENT").upper()
ENFORCEMENT_TOKEN_TTL = int(os.getenv("ENFORCEMENT_TOKEN_TTL", "300"))  # seconds

# Fine schedule (VND). The amount is DETERMINISTIC — derived from how far the 24h
# average exceeded the QCVN limit, not chosen by the LLM — so penalties stay
# predictable and defensible. amount = BASE + over * PER_RATIO, capped at MAX and
# rounded to ROUND, where over = measured/threshold - 1 (>= 0).
FINE_BASE_AMOUNT = float(os.getenv("FINE_BASE_AMOUNT", "10000000"))
FINE_PER_RATIO = float(os.getenv("FINE_PER_RATIO", "50000000"))
FINE_MAX_AMOUNT = float(os.getenv("FINE_MAX_AMOUNT", "100000000"))
FINE_ROUND = float(os.getenv("FINE_ROUND", "100000"))


# --- City-wide ministry email escalation ---
# When the backend detects that a large share of Hanoi's sensors are unhealthy, it
# calls POST /ministry-alert; the agent emails tailored directives to each ministry.
# If SMTP_HOST is unset, emails are composed and LOGGED instead of sent (safe dev
# default), so the flow is fully testable without real mail credentials.
MINISTRY_EMAIL_ENABLED = os.getenv("MINISTRY_EMAIL_ENABLED", "true").strip().lower() in (
    "1", "true", "yes", "on",
)
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").strip().lower() in ("1", "true", "yes", "on")
SMTP_FROM = os.getenv("SMTP_FROM", "AeroSense Alerts <no-reply@aerosensei.vn>")
SMTP_TIMEOUT = float(os.getenv("SMTP_TIMEOUT", "20"))
# Optional: route EVERY ministry email to this single inbox instead of the real
# per-ministry addresses (handy for demos/testing). Empty = use real addresses.
MINISTRY_TEST_RECIPIENT = os.getenv("MINISTRY_TEST_RECIPIENT", "").strip()


def get_provider():
    """Instantiate the configured LLM provider (single source of truth)."""
    if LLM_PROVIDER == "ollama":
        from providers.ollama_provider import OllamaProvider
        return OllamaProvider(model=LLM_MODEL, host=OLLAMA_HOST)
    if LLM_PROVIDER == "bedrock":
        from providers.bedrock_provider import BedrockProvider
        return BedrockProvider(model=BEDROCK_MODEL_ID, region=AWS_REGION)
    if LLM_PROVIDER == "litellm":
        from providers.litellm_provider import LiteLLMProvider
        return LiteLLMProvider(
            model=LLM_MODEL,
            api_base=LITELLM_API_BASE,
            api_key=LITELLM_API_KEY,
            context_window=LLM_CONTEXT_WINDOW,
        )
    if LLM_PROVIDER == "deepseek":
        if not DEEPSEEK_API_KEY:
            raise ValueError("LLM_PROVIDER=deepseek but DEEPSEEK_API_KEY is not set.")
        from providers.deepseek_provider import DeepSeekProvider
        return DeepSeekProvider(
            model=DEEPSEEK_MODEL,
            api_key=DEEPSEEK_API_KEY,
            api_base=DEEPSEEK_API_BASE,
            timeout=DEEPSEEK_TIMEOUT,
        )
    raise ValueError(
        f"Unknown LLM_PROVIDER: {LLM_PROVIDER!r} (expected 'ollama', 'bedrock', 'litellm', or 'deepseek')"
    )
