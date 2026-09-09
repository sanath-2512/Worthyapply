"""
Verify the hard wall-clock timeout does NOT wait for a hung provider thread.

The router uses a shared module-level ThreadPoolExecutor (never a `with` block), so
future.result(timeout) returns control immediately on timeout; the orphaned worker
thread is not joined before fallback proceeds.
"""

import threading
import time

from backend.llm_router.config import LLMConfig, ProviderSettings
from backend.llm_router.providers import LLMProvider
from backend.llm_router.router import ProviderRouter


class _R:
    def __init__(self, fn):
        self._fn = fn

    def invoke(self, prompt):
        return self._fn()


class BlockingProvider(LLMProvider):
    def __init__(self, name, block_seconds, timeout, priority):
        super().__init__(ProviderSettings(name, timeout, priority))
        self.model = f"fake-{name}"
        self.block_seconds = block_seconds
        self.released = threading.Event()

    def is_configured(self):
        return True

    def _api_key(self):
        return "x"

    def build_structured(self, response_format):
        def fn():
            # Simulate a provider that "hangs" well beyond its timeout.
            time.sleep(self.block_seconds)
            self.released.set()
            return "LATE"
        return _R(fn)


class FastProvider(LLMProvider):
    def __init__(self, name, priority):
        super().__init__(ProviderSettings(name, 5.0, priority))
        self.model = f"fake-{name}"

    def is_configured(self):
        return True

    def _api_key(self):
        return "x"

    def build_structured(self, response_format):
        return _R(lambda: "FAST")


def _router(providers):
    cfg = LLMConfig.from_env()
    cfg.circuit_cooldown_seconds = 0.5
    cfg.cooldown_timeout = 0.5
    cfg.providers = {p.name: ProviderSettings(p.name, p.timeout, p.priority) for p in providers}
    from backend.llm_router.health import HealthRegistry
    r = ProviderRouter(config=cfg)
    r.providers = {p.name: p for p in providers}
    r.health = HealthRegistry(cfg, [p.name for p in providers])
    return r


def test_hung_provider_does_not_block_request():
    hung = BlockingProvider("groq", block_seconds=30.0, timeout=0.5, priority=1)
    fast = FastProvider("gemini", priority=2)
    r = _router([hung, fast])

    t0 = time.monotonic()
    res = r.invoke_structured("p", str)
    elapsed = time.monotonic() - t0

    # The request completed via fallback in ~timeout, NOT after the 30s hang.
    assert res.provider == "gemini" and res.value == "FAST"
    assert elapsed < 3.0, f"request blocked for {elapsed:.2f}s (should be ~0.5s)"
    # The hung worker is still running (not joined) — proving we didn't wait for it.
    assert not hung.released.is_set(), "we waited for the hung provider thread"
