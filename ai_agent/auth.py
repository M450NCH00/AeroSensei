"""Caller authentication + authorization for the agent.

The backend issues JWTs as an httpOnly `accessToken` cookie (HS256, signed with
the shared secret). The agent:
  1. extracts that token from the incoming request,
  2. verifies it with the same secret and checks the caller's role,
  3. forwards the SAME token back to the backend on every tool call, so the
     backend's own JWT filter + @PreAuthorize checks are the real gatekeeper.

The agent never holds DB credentials and never elevates privileges.
"""
import jwt

import config


class AuthError(Exception):
    """Raised when the caller is missing/invalid or lacks the required role."""

    def __init__(self, message: str, status: int = 401):
        super().__init__(message)
        self.status = status


def extract_token(request) -> str:
    """Pull the JWT from the accessToken cookie, falling back to a Bearer header
    (handy for curl/testing)."""
    token = request.cookies.get("accessToken")
    if token:
        return token
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer "):].strip()
    raise AuthError("Missing authentication token", status=401)


def authorize(token: str) -> dict:
    """Verify the token and ensure the caller holds an allowed role.

    Returns the decoded claims (subject = email, plus roles/permissions).
    """
    try:
        claims = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired", status=401)
    except jwt.InvalidTokenError:
        raise AuthError("Invalid token", status=401)

    roles = {str(r).upper() for r in (claims.get("roles") or [])}
    if not roles & config.ALLOWED_ROLES:
        raise AuthError(
            f"Access denied: this assistant is restricted to {sorted(config.ALLOWED_ROLES)}",
            status=403,
        )
    return claims


def authenticate(request) -> tuple[str, dict]:
    """Convenience: extract + authorize in one step.

    Returns (token, claims). The token is forwarded to the backend; claims carry
    the caller's identity for logging/context.
    """
    token = extract_token(request)
    claims = authorize(token)
    return token, claims
