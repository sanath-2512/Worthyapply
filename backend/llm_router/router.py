"""
ProviderRouter — the routing layer.

Responsibilities:
- Select the best currently-healthy provider (deterministic score).
- Enforce a HARD per-attempt wall-clock timeout (works even for sync SDKs that
  ignore their own timeout) so a hung provider cannot block for minutes.
- Classify failures, update health + circuit breaker, and fall back to the next
  healthy provider.
- Treat invalid structured output as a provider failure (schema-level fallback).
- Stream tokens with a first-token timeout; never splice two providers mid-stream.
- Be concurrency-safe and observable.
"""

from __future__ import annotations

import logging
import queue
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from dataclasses import dataclass
from typing import Iterator, Optional

from .config import LLMConfig, TASK_PREFERENCES
from .errors import (
    AllProvidersFailedError,
    ErrorType,
    SchemaValidationError,
    classify_error,
)
from .health import HealthRegistry
from .providers import LLMProvider, build_providers

logger = logging.getLogger("worthyapply.llm_router")

# A shared executor for running blocking provider calls with a wall-clock cap.
# Threads that outlive their timeout are abandoned; the SDK timeout + max_retries=0
# bound their lifetime so they don't accumulate.
_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="llm-router")


@dataclass
class RouterResult:
    value: object
    provider: str
    model: str
    latency_ms: float
    fallback_used: bool
    fallback_from: Optional[str]


class ProviderRouter:
    def __init__(self, config: Optional[LLMConfig] = None):
        self.config = config or LLMConfig.from_env()
        self.providers: dict[str, LLMProvider] = build_providers(self.config)
        self.health = HealthRegistry(self.config, list(self.providers.keys()))

    # ---------------------------------------------------------------- selection
    def _configured_providers(self) -> list[str]:
        return [n for n, p in self.providers.items() if p.is_configured()]

    def _ordered_candidates(self, task_type: Optional[str]) -> list[str]:
        """Healthy, configured providers ordered by score (best first).

        A provider whose circuit is HALF_OPEN is surfaced FIRST so its single
        recovery trial actually fires — otherwise a demoted (recently-failed)
        provider could never recover while any healthy provider exists.
        """
        from .circuit_breaker import CircuitState

        prefs = TASK_PREFERENCES.get(task_type or "", [])

        def sort_key(name: str) -> float:
            score = self.health.score(name)
            if name in prefs:
                # Preferred providers get a bonus (index 0 strongest).
                score -= (len(prefs) - prefs.index(name)) * 3.0
            return score

        configured = self._configured_providers()
        half_open = [n for n in configured if self.health.circuit_state(n) == CircuitState.HALF_OPEN]
        others = [n for n in configured if n not in half_open]
        # HALF_OPEN trials first (each provider allows only one trial internally),
        # then the rest by score.
        return sorted(half_open, key=sort_key) + sorted(others, key=sort_key)

    # ------------------------------------------------------------- hard timeout
    def _call_with_timeout(self, fn, timeout: float):
        """Run fn() in a worker thread; raise FuturesTimeout if it exceeds timeout."""
        future = _EXECUTOR.submit(fn)
        try:
            return future.result(timeout=timeout)
        except FuturesTimeout:
            future.cancel()  # best-effort; the orphaned call is bounded by SDK timeout
            raise

    # --------------------------------------------------------------- invocation
    def invoke_structured(self, prompt: str, response_format, task_type: Optional[str] = None) -> RouterResult:
        """
        Route a structured-output request across providers with fast fallback.
        Returns RouterResult. Raises AllProvidersFailedError if everyone fails,
        or RuntimeError if no provider is configured.
        """
        candidates = self._ordered_candidates(task_type)
        if not candidates:
            raise RuntimeError("No LLM provider configured. Set at least one API key.")

        first_choice = candidates[0]
        last_error: Optional[Exception] = None

        for name in candidates:
            if not self.health.allow(name):
                logger.info("llm_router skip provider=%s reason=circuit_open task=%s", name, task_type)
                continue

            provider = self.providers[name]
            t0 = time.monotonic()
            try:
                runnable = provider.build_structured(response_format)
                result = self._call_with_timeout(lambda: runnable.invoke(prompt), provider.timeout)

                # HTTP-200 is not enough — validate the structured object.
                if result is None:
                    raise SchemaValidationError("provider returned no structured object")

                latency_ms = (time.monotonic() - t0) * 1000
                self.health.record_success(name, latency_ms)
                fallback_used = name != first_choice
                logger.info(
                    "llm_router provider=%s model=%s task=%s latency_ms=%.0f success=true fallback_used=%s",
                    name, provider.model, task_type, latency_ms, fallback_used,
                )
                return RouterResult(
                    value=result, provider=name, model=provider.model,
                    latency_ms=latency_ms, fallback_used=fallback_used,
                    fallback_from=first_choice if fallback_used else None,
                )
            except Exception as e:
                last_error = e
                etype = classify_error(e)
                self.health.record_failure(name, etype)
                latency_ms = (time.monotonic() - t0) * 1000
                logger.warning(
                    "llm_router provider=%s model=%s task=%s latency_ms=%.0f success=false error=%s -> fallback",
                    name, provider.model, task_type, latency_ms, etype.value,
                )
                if not self.config.enable_fallback:
                    break
                continue

        raise AllProvidersFailedError(
            f"All providers failed for task={task_type}. Last error: {last_error}"
        )

    # ---------------------------------------------------------------- streaming
    def stream_structured(self, prompt: str, response_format, task_type: Optional[str] = None) -> Iterator[dict]:
        """
        Stream tokens across providers. Yields:
            {"type":"token","text":...}   as tokens arrive
            {"type":"result","value":...} final parsed+validated object

        First-token timeout: if a provider produces no first token within its
        timeout, abandon it and fall back — but ONLY before any token has been
        yielded downstream. Once tokens are committed we never switch providers.
        """
        from .stream_util import build_stream_prompt, extract_and_validate, iter_stream_with_timeout

        candidates = self._ordered_candidates(task_type)
        if not candidates:
            raise RuntimeError("No LLM provider configured. Set at least one API key.")

        first_choice = candidates[0]
        full_prompt = build_stream_prompt(prompt, response_format)
        last_error: Optional[Exception] = None

        for name in candidates:
            if not self.health.allow(name):
                logger.info("llm_router(stream) skip provider=%s reason=circuit_open", name)
                continue

            provider = self.providers[name]
            t0 = time.monotonic()
            emitted_tokens = False  # did we stream any (cosmetic) token text?
            accumulated = ""
            try:
                raw = provider.build_raw()
                for delta in iter_stream_with_timeout(
                    raw, full_prompt, first_token_timeout=provider.timeout,
                    inactivity_timeout=provider.timeout,
                ):
                    accumulated += delta
                    emitted_tokens = True
                    yield {"type": "token", "text": delta}

                parsed = extract_and_validate(accumulated, response_format)  # may raise
                latency_ms = (time.monotonic() - t0) * 1000
                self.health.record_success(name, latency_ms)
                logger.info(
                    "llm_router(stream) provider=%s task=%s latency_ms=%.0f success=true fallback_used=%s",
                    name, task_type, latency_ms, name != first_choice,
                )
                yield {"type": "result", "value": parsed}
                return
            except Exception as e:
                last_error = e
                etype = classify_error(e)
                self.health.record_failure(name, etype)
                logger.warning(
                    "llm_router(stream) provider=%s task=%s success=false error=%s emitted_tokens=%s -> fallback",
                    name, task_type, etype.value, emitted_tokens,
                )
                # The streamed tokens are RAW JSON shown only as a cosmetic "typing"
                # animation — they are NOT the final result (that comes from the
                # validated `result` yield). So we can always fall back to the next
                # provider on any failure here; we never delivered usable output.
                # If tokens were shown, tell the client to reset the partial text so
                # the next provider's stream doesn't concatenate onto garbage.
                if emitted_tokens:
                    yield {"type": "reset"}
                if not self.config.enable_fallback:
                    break
                continue

        raise AllProvidersFailedError(
            f"All providers failed to stream for task={task_type}. Last error: {last_error}"
        )

    # -------------------------------------------------------------- observability
    def health_snapshot(self) -> dict:
        return self.health.snapshot_all()
