"""
Thread-safe per-provider health tracking.

Concurrency: LLM calls originate from FastAPI worker threads (asyncio.to_thread),
so all health mutations are serialized by a single lock. State is tiny, so lock
contention is negligible.

Distributed limitation: this registry is in-memory / per-process. On a single
instance that is correct. For multi-worker/multi-container deployments a shared
backend (e.g. Redis) would be needed — the registry is written behind a small
interface so a RedisHealthRegistry could replace it without touching the router.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

from .circuit_breaker import CircuitBreaker, CircuitState
from .config import LLMConfig
from .errors import ErrorType, cooldown_for


@dataclass
class ProviderHealth:
    name: str
    successes: int = 0
    failures: int = 0
    consecutive_failures: int = 0
    timeout_failures: int = 0
    rate_limit_failures: int = 0
    server_error_failures: int = 0
    auth_failures: int = 0
    validation_failures: int = 0
    ewma_latency_ms: float = 0.0
    last_success: float = 0.0
    last_failure: float = 0.0
    cooldown_until: float = 0.0
    circuit: CircuitBreaker = None  # set in __post_init__ via registry

    def snapshot(self) -> dict:
        return {
            "name": self.name,
            "successes": self.successes,
            "failures": self.failures,
            "consecutive_failures": self.consecutive_failures,
            "timeout_failures": self.timeout_failures,
            "rate_limit_failures": self.rate_limit_failures,
            "server_error_failures": self.server_error_failures,
            "auth_failures": self.auth_failures,
            "validation_failures": self.validation_failures,
            "ewma_latency_ms": round(self.ewma_latency_ms, 1),
            "circuit_state": self.circuit.state.value if self.circuit else "CLOSED",
        }


_EWMA_ALPHA = 0.3  # weight of the newest latency sample


class HealthRegistry:
    """One ProviderHealth per provider, guarded by a single lock."""

    def __init__(self, config: LLMConfig, provider_names: list[str]):
        self._config = config
        self._lock = threading.Lock()
        self._health: dict[str, ProviderHealth] = {}
        for name in provider_names:
            h = ProviderHealth(name=name)
            h.circuit = CircuitBreaker(
                failure_threshold=config.circuit_failure_threshold,
                cooldown_seconds=config.circuit_cooldown_seconds,
            )
            self._health[name] = h

    def allow(self, name: str) -> bool:
        """Whether the circuit permits a request to this provider right now."""
        with self._lock:
            h = self._health.get(name)
            if h is None:
                return False
            if h.cooldown_until and time.monotonic() < h.cooldown_until:
                # Still in an error cooldown independent of circuit trial logic.
                # Let the circuit decide (it may be HALF_OPEN and allow a trial).
                pass
            return h.circuit.allow_request()

    def circuit_state(self, name: str) -> CircuitState:
        with self._lock:
            h = self._health.get(name)
            return h.circuit.refresh() if h else CircuitState.CLOSED

    def record_success(self, name: str, latency_ms: float):
        with self._lock:
            h = self._health.get(name)
            if h is None:
                return
            h.successes += 1
            h.consecutive_failures = 0
            h.last_success = time.monotonic()
            h.cooldown_until = 0.0
            h.ewma_latency_ms = (
                latency_ms if h.ewma_latency_ms == 0.0
                else _EWMA_ALPHA * latency_ms + (1 - _EWMA_ALPHA) * h.ewma_latency_ms
            )
            h.circuit.record_success()

    def record_failure(self, name: str, error_type: ErrorType):
        with self._lock:
            h = self._health.get(name)
            if h is None:
                return
            h.failures += 1
            h.consecutive_failures += 1
            h.last_failure = time.monotonic()
            if error_type == ErrorType.TIMEOUT:
                h.timeout_failures += 1
            elif error_type == ErrorType.RATE_LIMIT:
                h.rate_limit_failures += 1
            elif error_type == ErrorType.SERVER_ERROR:
                h.server_error_failures += 1
            elif error_type == ErrorType.AUTH:
                h.auth_failures += 1
            elif error_type == ErrorType.VALIDATION:
                h.validation_failures += 1

            cooldown = cooldown_for(error_type, self._config)
            h.cooldown_until = time.monotonic() + cooldown
            h.circuit.record_failure(cooldown_override=cooldown)

    def get(self, name: str) -> ProviderHealth | None:
        with self._lock:
            return self._health.get(name)

    def score(self, name: str) -> float:
        """Lower is better. priority-dominant + latency + recent-failure penalty."""
        with self._lock:
            h = self._health.get(name)
            settings = self._config.providers.get(name)
            if h is None or settings is None:
                return float("inf")
            return (
                settings.priority * 10.0
                + h.ewma_latency_ms / 1000.0
                + h.consecutive_failures * 5.0
            )

    def snapshot_all(self) -> dict:
        with self._lock:
            return {name: h.snapshot() for name, h in self._health.items()}
