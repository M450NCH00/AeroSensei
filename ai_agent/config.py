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

# Max LLM<->tool round trips before we force a final answer.
MAX_TOOL_ITERATIONS = int(os.getenv("LLM_MAX_TOOL_ITERATIONS", "5"))

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

# Telegram bot's internal push endpoint and its shared secret (NOTIFY_SECRET on
# the bot side). The agent POSTs the composed alert here to broadcast it.
TELEGRAM_NOTIFY_URL = os.getenv("TELEGRAM_NOTIFY_URL", "http://telegram-bot:5002/notify").rstrip("/")
TELEGRAM_NOTIFY_SECRET = os.getenv("TELEGRAM_NOTIFY_SECRET", "").strip()
TELEGRAM_NOTIFY_TIMEOUT = float(os.getenv("TELEGRAM_NOTIFY_TIMEOUT", "15"))

# --- PDF report generation ---
# Generated PDFs are stored in MinIO (S3) and streamed back via GET /reports/<file>.
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
MINIO_REPORTS_BUCKET = os.getenv("MINIO_REPORTS_BUCKET", "reports")
# Public base URL of this agent, used to build absolute download links the
# browser can open. Matches the frontend's NEXT_PUBLIC_AI_AGENT_URL.
AGENT_PUBLIC_URL = os.getenv("AGENT_PUBLIC_URL", "http://localhost:5001").rstrip("/")


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
    raise ValueError(
        f"Unknown LLM_PROVIDER: {LLM_PROVIDER!r} (expected 'ollama', 'bedrock', or 'litellm')"
    )
