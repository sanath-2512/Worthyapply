"""
LLM provider router package.

Public surface:
    router                 -- the process-wide ProviderRouter singleton
    get_structured_llm     -- backward-compatible: returns an object with .invoke(prompt)
    stream_structured_llm  -- backward-compatible: yields {"type":"token"/"result", ...}

These two functions preserve the exact signatures the application already uses, so
no call site changes are required. They are re-exported from backend/llm.py too.
"""

from __future__ import annotations

import threading
from typing import Iterator, Optional

from .errors import AllProvidersFailedError, SchemaValidationError
from .router import ProviderRouter, RouterResult

_router_lock = threading.Lock()
_router: Optional[ProviderRouter] = None


def get_router() -> ProviderRouter:
    """Lazy, thread-safe singleton so config/env is read once at first use."""
    global _router
    if _router is None:
        with _router_lock:
            if _router is None:
                _router = ProviderRouter()
    return _router


class _RouterRunnable:
    """Minimal shim exposing .invoke(prompt) so existing call sites work unchanged."""

    def __init__(self, response_format, task_type: Optional[str] = None):
        self._response_format = response_format
        self._task_type = task_type

    def invoke(self, prompt: str):
        result: RouterResult = get_router().invoke_structured(
            prompt, self._response_format, task_type=self._task_type
        )
        return result.value


def get_structured_llm(response_format, task_type: Optional[str] = None):
    """
    Backward-compatible factory. Returns a runnable with .invoke(prompt) that
    routes through the provider router (selection + timeout + fallback + circuit).
    """
    # Preserve the original "no provider configured" contract eagerly.
    router = get_router()
    if not router._configured_providers():
        raise RuntimeError("No LLM provider configured. Set at least one API key.")
    return _RouterRunnable(response_format, task_type=task_type)


def stream_structured_llm(prompt: str, response_format, task_type: Optional[str] = None) -> Iterator[dict]:
    """Backward-compatible streaming generator routed through the router."""
    yield from get_router().stream_structured(prompt, response_format, task_type=task_type)


# Convenience alias used by other modules that want the singleton directly.
router = get_router
