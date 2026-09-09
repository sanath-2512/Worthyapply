"""
Centralized error classification for the LLM router.

Turns any provider exception into an ErrorType so the router can apply the right
cooldown and decide whether/where to fall back. Distinguishes a genuine LLM
success from an HTTP-200-but-invalid-output (VALIDATION) failure.
"""

from __future__ import annotations

import concurrent.futures
from enum import Enum

from .config import LLMConfig


class ErrorType(str, Enum):
    TIMEOUT = "timeout"
    RATE_LIMIT = "rate_limit"
    AUTH = "auth"
    SERVER_ERROR = "server_error"
    VALIDATION = "validation"
    UNKNOWN = "unknown"


class SchemaValidationError(Exception):
    """Raised when a provider responded but the output failed schema validation.

    Treated as a provider failure so the router falls back to another provider.
    """


class AllProvidersFailedError(RuntimeError):
    """Raised when every healthy provider has been exhausted for a request."""


def _status_code(exc: Exception):
    for attr in ("status_code", "code", "http_status", "status"):
        val = getattr(exc, attr, None)
        if isinstance(val, int):
            return val
    # Some SDKs nest it under .response.status_code
    resp = getattr(exc, "response", None)
    if resp is not None:
        val = getattr(resp, "status_code", None)
        if isinstance(val, int):
            return val
    return None


def classify_error(exc: Exception) -> ErrorType:
    """Map an exception to an ErrorType using type, status code, and message text."""
    if isinstance(exc, SchemaValidationError):
        return ErrorType.VALIDATION
    if isinstance(exc, (TimeoutError, concurrent.futures.TimeoutError)):
        return ErrorType.TIMEOUT

    status = _status_code(exc)
    msg = str(exc).lower()

    # Rate limit / quota — includes Groq's 413 "request too large ... tokens per minute".
    if status == 429 or any(
        s in msg for s in ("rate limit", "rate_limit", "quota", "tokens per minute", "too many requests")
    ):
        return ErrorType.RATE_LIMIT
    if status == 413 and ("tokens per minute" in msg or "rate" in msg or "tpm" in msg):
        return ErrorType.RATE_LIMIT

    # Auth
    if status in (401, 403) or any(
        s in msg for s in ("unauthorized", "invalid api key", "invalid_api_key", "authentication", "permission")
    ):
        return ErrorType.AUTH

    # Server errors
    if status in (500, 502, 503, 504) or any(
        s in msg for s in (
            "internal server error", "bad gateway", "service unavailable",
            "gateway timeout", " 500", " 502", " 503", " 504",
        )
    ):
        return ErrorType.SERVER_ERROR

    # Timeout by message (SDK-level)
    if "timeout" in msg or "timed out" in msg:
        return ErrorType.TIMEOUT

    return ErrorType.UNKNOWN


def cooldown_for(error_type: ErrorType, config: LLMConfig) -> float:
    """Seconds to keep a provider in cooldown given the error type."""
    return {
        ErrorType.TIMEOUT: config.cooldown_timeout,
        ErrorType.RATE_LIMIT: config.cooldown_rate_limit,
        ErrorType.AUTH: config.cooldown_auth,
        ErrorType.SERVER_ERROR: config.cooldown_server_error,
        ErrorType.VALIDATION: config.cooldown_validation,
        ErrorType.UNKNOWN: config.cooldown_unknown,
    }.get(error_type, config.cooldown_unknown)
