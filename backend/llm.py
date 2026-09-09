"""
Backward-compatible LLM entry point.

This module used to build a Groq -> Gemini -> ... `.with_fallbacks()` chain. It is
now a thin compatibility shim over the production-grade provider router in
`backend/llm_router/`, which adds:
  - hard per-provider wall-clock timeouts (a hung provider can no longer block for
    minutes),
  - per-provider health tracking + circuit breaker (a known-bad provider is skipped
    on later requests instead of being retried from scratch),
  - centralized error classification and error-specific cooldowns,
  - deterministic health-aware provider selection,
  - structured-output validation as a fallback trigger,
  - streaming with a first-token timeout.

The public functions below keep their original signatures so every existing call
site (pipeline.py, resume_extractor.py, resume_tailor.py) works unchanged.
"""

from __future__ import annotations

from typing import Iterator

from .llm_router import (  # re-export
    get_structured_llm,
    stream_structured_llm,
    get_router,
)

__all__ = ["get_structured_llm", "stream_structured_llm", "get_router"]
