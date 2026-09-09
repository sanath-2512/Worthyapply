"""
Per-provider circuit breaker: CLOSED -> OPEN -> HALF_OPEN -> CLOSED.

- CLOSED: normal. Consecutive failures accumulate; at the threshold -> OPEN.
- OPEN: provider is skipped until the cooldown expires, then -> HALF_OPEN.
- HALF_OPEN: exactly ONE trial request is allowed. Success -> CLOSED; failure -> OPEN.

Callers must hold the HealthRegistry lock when mutating a breaker; the breaker
itself is a plain state holder so all state changes are serialized by that lock.
"""

from __future__ import annotations

import time
from enum import Enum


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    def __init__(self, failure_threshold: int, cooldown_seconds: float):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state: CircuitState = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.open_until = 0.0
        # True once a HALF_OPEN trial has been handed out (prevents multiple trials).
        self._trial_in_flight = False

    def _now(self) -> float:
        return time.monotonic()

    def refresh(self) -> CircuitState:
        """Advance OPEN -> HALF_OPEN if the cooldown has expired. Returns current state."""
        if self.state == CircuitState.OPEN and self._now() >= self.open_until:
            self.state = CircuitState.HALF_OPEN
            self._trial_in_flight = False
        return self.state

    def allow_request(self) -> bool:
        """Whether a request may be sent to this provider right now."""
        state = self.refresh()
        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.OPEN:
            return False
        # HALF_OPEN: allow exactly one trial.
        if not self._trial_in_flight:
            self._trial_in_flight = True
            return True
        return False

    def record_success(self):
        self.consecutive_failures = 0
        self.state = CircuitState.CLOSED
        self.open_until = 0.0
        self._trial_in_flight = False

    def record_failure(self, cooldown_override: float | None = None):
        self.consecutive_failures += 1
        cooldown = self.cooldown_seconds if cooldown_override is None else cooldown_override

        if self.state == CircuitState.HALF_OPEN:
            # Trial failed -> re-open immediately.
            self.state = CircuitState.OPEN
            self.open_until = self._now() + cooldown
            self._trial_in_flight = False
        elif self.consecutive_failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
            self.open_until = self._now() + cooldown
            self._trial_in_flight = False

    def seconds_until_retry(self) -> float:
        if self.state == CircuitState.OPEN:
            return max(0.0, self.open_until - self._now())
        return 0.0
