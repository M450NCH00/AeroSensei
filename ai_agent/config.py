"""Central configuration loaded from environment variables.

Everything that differs between local (Ollama) and the future AWS (Bedrock)
deployment is driven from here so the rest of the code stays provider-agnostic.
"""
import os


def _split(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


# --- LLM provider selection ---
# Which backend drives the tool-calling loop. "ollama" today, "bedrock" later.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()

# Model id. For Ollama this MUST be a tool-capable model (e.g. qwen2.5:7b-instruct,
# llama3.1:8b, mistral-nemo). The default qwen3:0.6b cannot tool-call reliably.
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b-instruct")

# Ollama server endpoint.
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")

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

# --- Auth ---
# Shared HS256 secret used by the backend to sign JWTs. The agent verifies the
# caller's token with the same secret. MUST match the backend's JWT_SECRET.
JWT_SECRET = os.getenv("JWT_SECRET", "your-hackathon-super-secret-key-xyz123")

# Roles permitted to use the agent. Admin-only for now.
ALLOWED_ROLES = {r.upper() for r in _split(os.getenv("AGENT_ALLOWED_ROLES", "ADMIN"))}


def get_provider():
    """Instantiate the configured LLM provider (single source of truth)."""
    if LLM_PROVIDER == "ollama":
        from providers.ollama_provider import OllamaProvider
        return OllamaProvider(model=LLM_MODEL, host=OLLAMA_HOST)
    if LLM_PROVIDER == "bedrock":
        from providers.bedrock_provider import BedrockProvider
        return BedrockProvider(model=BEDROCK_MODEL_ID, region=AWS_REGION)
    raise ValueError(f"Unknown LLM_PROVIDER: {LLM_PROVIDER!r} (expected 'ollama' or 'bedrock')")
