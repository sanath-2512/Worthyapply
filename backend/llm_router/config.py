"""
Centralized, env-driven configuration for the LLM provider router.

Nothing about routing behavior is hardcoded across the codebase — every tunable
lives here and can be overridden via environment variables. API keys are read by
the provider adapters directly (never stored/logged here).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


# Provider names — single source of truth for ordering/priority defaults.
PROVIDER_NAMES = ["groq", "gemini", "openrouter", "mistral", "cohere"]

# Default per-provider timeouts (seconds). Deliberately higher than a chat-reply
# default because our calls return large structured JSON (full resume/analysis).
# All env-tunable via LLM_<PROVIDER>_TIMEOUT.
_DEFAULT_TIMEOUTS = {
    "groq": 25.0,
    "gemini": 30.0,
    "openrouter": 35.0,
    "mistral": 35.0,
    # Cohere is reliable but slow for the large combined-analysis JSON (~28-30s
    # observed); give it enough room to finish rather than timing out just short.
    "cohere": 45.0,
}

# Default priorities (lower = tried first).
# Ordered by observed reliability+speed: Groq (fast when available) -> Cohere
# (reliably returns valid output) -> Mistral -> OpenRouter (slow free model) ->
# Gemini (currently prone to 503/504). Tunable via LLM_<PROVIDER>_PRIORITY.
_DEFAULT_PRIORITIES = {
    "groq": 1,
    "cohere": 2,
    "mistral": 3,
    "openrouter": 4,
    "gemini": 5,
}

# Optional task-type -> preferred provider ordering. Providers listed here get a
# small scoring bonus for that task. Extend freely without touching the router.
TASK_PREFERENCES: dict[str, list[str]] = {
    # "resume_analysis": ["groq", "gemini"],
    # "structured_extraction": ["groq", "mistral"],
}


@dataclass
class ProviderSettings:
    name: str
    timeout: float
    priority: int


@dataclass
class LLMConfig:
    providers: dict[str, ProviderSettings] = field(default_factory=dict)

    # Circuit breaker
    circuit_failure_threshold: int = 3
    circuit_cooldown_seconds: float = 60.0

    # Error-specific cooldowns (seconds)
    cooldown_timeout: float = 20.0
    cooldown_rate_limit: float = 60.0
    cooldown_server_error: float = 20.0
    cooldown_auth: float = 900.0
    cooldown_validation: float = 15.0
    cooldown_unknown: float = 20.0

    enable_fallback: bool = True

    @classmethod
    def from_env(cls) -> "LLMConfig":
        providers = {}
        for name in PROVIDER_NAMES:
            providers[name] = ProviderSettings(
                name=name,
                timeout=_env_float(f"LLM_{name.upper()}_TIMEOUT", _DEFAULT_TIMEOUTS[name]),
                priority=_env_int(f"LLM_{name.upper()}_PRIORITY", _DEFAULT_PRIORITIES[name]),
            )
        return cls(
            providers=providers,
            circuit_failure_threshold=_env_int("LLM_CIRCUIT_FAILURE_THRESHOLD", 3),
            circuit_cooldown_seconds=_env_float("LLM_CIRCUIT_COOLDOWN_SECONDS", 60.0),
            cooldown_timeout=_env_float("LLM_COOLDOWN_TIMEOUT", 20.0),
            cooldown_rate_limit=_env_float("LLM_COOLDOWN_RATE_LIMIT", 60.0),
            cooldown_server_error=_env_float("LLM_COOLDOWN_SERVER_ERROR", 20.0),
            cooldown_auth=_env_float("LLM_COOLDOWN_AUTH", 900.0),
            cooldown_validation=_env_float("LLM_COOLDOWN_VALIDATION", 15.0),
            cooldown_unknown=_env_float("LLM_COOLDOWN_UNKNOWN", 20.0),
            enable_fallback=_env_bool("LLM_ENABLE_FALLBACK", True),
        )
