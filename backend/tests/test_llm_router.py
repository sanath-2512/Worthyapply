"""
Tests for the multi-provider LLM router (no network).

Covers the 9 required scenarios using fake providers whose behavior we control:
success, timeout->fallback, 429->cooldown, repeated-fail->circuit-open->skip,
recovery (OPEN->HALF_OPEN->CLOSED), chained fallback, all-fail controlled error,
invalid structured output->fallback, and concurrency. Plus a timing assertion that
a slow provider is abandoned in ~timeout rather than blocking for minutes.

Run: .venv/bin/python -m pytest backend/tests/test_llm_router.py -q
"""

import threading
import time

import pytest

from backend.llm_router.config import LLMConfig, ProviderSettings
from backend.llm_router.errors import AllProvidersFailedError, SchemaValidationError
from backend.llm_router.providers import LLMProvider
from backend.llm_router.router import ProviderRouter


# --------------------------------------------------------------------------- fakes
class _FakeRunnable:
    def __init__(self, behavior):
        self._behavior = behavior

    def invoke(self, prompt):
        return self._behavior()


class FakeProvider(LLMProvider):
    """A provider whose invoke() behavior is fully controlled by a callable."""

    def __init__(self, name, behavior, timeout=1.0, priority=1):
        settings = ProviderSettings(name=name, timeout=timeout, priority=priority)
        super().__init__(settings)
        self.model = f"fake-{name}"
        self._behavior = behavior
        self.calls = 0

    def is_configured(self):
        return True

    def _api_key(self):
        return "fake"

    def build_structured(self, response_format):
        def wrapped():
            self.calls += 1
            return self._behavior(self)
        return _FakeRunnable(wrapped)


def make_router(providers, **cfg_overrides):
    cfg = LLMConfig.from_env()
    # tighten circuit + cooldowns for fast tests
    cfg.circuit_failure_threshold = cfg_overrides.get("threshold", 3)
    cfg.circuit_cooldown_seconds = cfg_overrides.get("cooldown", 0.3)
    cfg.cooldown_timeout = cfg_overrides.get("cooldown", 0.3)
    cfg.cooldown_rate_limit = cfg_overrides.get("rate_cooldown", 0.3)
    cfg.cooldown_server_error = 0.3
    cfg.cooldown_validation = 0.3
    cfg.cooldown_unknown = 0.3
    # rebuild provider settings so priorities match insertion order
    cfg.providers = {p.name: ProviderSettings(p.name, p.timeout, p.priority) for p in providers}
    r = ProviderRouter(config=cfg)
    r.providers = {p.name: p for p in providers}
    from backend.llm_router.health import HealthRegistry
    r.health = HealthRegistry(cfg, [p.name for p in providers])
    return r


# helpers
def ok(value="RESULT"):
    return lambda self: value


def raise_(exc):
    def _b(self):
        raise exc
    return _b


def rate_limit():
    e = Exception("Error 429: rate limit exceeded, tokens per minute")
    return raise_(e)


def slow(seconds):
    def _b(self):
        time.sleep(seconds)
        return "SLOW_RESULT"
    return _b


# --------------------------------------------------------------------------- tests
def test_1_groq_succeeds():
    groq = FakeProvider("groq", ok("G"), priority=1)
    gemini = FakeProvider("gemini", ok("X"), priority=2)
    r = make_router([groq, gemini])
    res = r.invoke_structured("p", str)
    assert res.value == "G"
    assert res.provider == "groq"
    assert res.fallback_used is False
    assert groq.calls == 1 and gemini.calls == 0  # only groq called


def test_2_groq_timeout_then_gemini():
    groq = FakeProvider("groq", slow(2.0), timeout=0.3, priority=1)
    gemini = FakeProvider("gemini", ok("GEM"), priority=2)
    r = make_router([groq, gemini])
    t0 = time.monotonic()
    res = r.invoke_structured("p", str)
    elapsed = time.monotonic() - t0
    assert res.provider == "gemini" and res.value == "GEM"
    assert res.fallback_used is True and res.fallback_from == "groq"
    # Fell back in ~timeout, NOT after the 2s hang.
    assert elapsed < 1.0, f"took {elapsed:.2f}s — timeout not enforced"
    assert r.health.get("groq").timeout_failures == 1


def test_3_groq_429_cooldown_then_gemini():
    groq = FakeProvider("groq", rate_limit(), priority=1)
    gemini = FakeProvider("gemini", ok("GEM"), priority=2)
    r = make_router([groq, gemini])
    res = r.invoke_structured("p", str)
    assert res.provider == "gemini"
    assert r.health.get("groq").rate_limit_failures == 1
    assert r.health.get("groq").cooldown_until > time.monotonic()


def test_4_repeated_failures_open_circuit_then_skip():
    groq = FakeProvider("groq", raise_(Exception("boom 500 internal server error")), priority=1)
    gemini = FakeProvider("gemini", ok("GEM"), priority=2)
    r = make_router([groq, gemini], threshold=3, cooldown=5.0)
    for _ in range(3):
        r.invoke_structured("p", str)
    # Circuit should now be OPEN -> next request skips groq entirely.
    calls_before = groq.calls
    res = r.invoke_structured("p", str)
    assert res.provider == "gemini"
    assert groq.calls == calls_before, "groq was called despite OPEN circuit"


def test_5_provider_recovery_half_open_to_closed():
    state = {"fail": True}

    def flaky(self):
        if state["fail"]:
            raise Exception("boom 503 service unavailable")
        return "RECOVERED"

    groq = FakeProvider("groq", flaky, priority=1)
    gemini = FakeProvider("gemini", ok("GEM"), priority=2)
    r = make_router([groq, gemini], threshold=3, cooldown=0.3)
    for _ in range(3):
        r.invoke_structured("p", str)  # opens circuit
    assert r.health.circuit_state("groq").value == "OPEN"
    time.sleep(0.35)  # cooldown expires -> HALF_OPEN
    state["fail"] = False
    res = r.invoke_structured("p", str)  # trial succeeds
    assert res.provider == "groq" and res.value == "RECOVERED"
    assert r.health.circuit_state("groq").value == "CLOSED"


def test_6_chained_fallback_to_openrouter():
    groq = FakeProvider("groq", raise_(Exception("boom 500")), priority=1)
    gemini = FakeProvider("gemini", raise_(Exception("boom 502 bad gateway")), priority=2)
    openrouter = FakeProvider("openrouter", ok("OR"), priority=3)
    r = make_router([groq, gemini, openrouter])
    res = r.invoke_structured("p", str)
    assert res.provider == "openrouter" and res.value == "OR"


def test_7_all_providers_fail_controlled_error():
    groq = FakeProvider("groq", raise_(Exception("boom 500")), priority=1)
    gemini = FakeProvider("gemini", raise_(Exception("boom 500")), priority=2)
    r = make_router([groq, gemini])
    with pytest.raises(AllProvidersFailedError):
        r.invoke_structured("p", str)


def test_8_invalid_structured_output_falls_back():
    # groq "succeeds" at HTTP level but returns None -> treated as validation failure
    groq = FakeProvider("groq", ok(None), priority=1)
    gemini = FakeProvider("gemini", ok("VALID"), priority=2)
    r = make_router([groq, gemini])
    res = r.invoke_structured("p", str)
    assert res.provider == "gemini" and res.value == "VALID"


def test_9_concurrent_requests_consistent_health():
    # groq always fails; gemini always ok. Fire many concurrent requests.
    groq = FakeProvider("groq", raise_(Exception("boom 500")), priority=1)
    gemini = FakeProvider("gemini", ok("GEM"), priority=2)
    r = make_router([groq, gemini], threshold=1000, cooldown=0.0)
    results = []
    errors = []

    def worker():
        try:
            results.append(r.invoke_structured("p", str).provider)
        except Exception as e:  # pragma: no cover
            errors.append(e)

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    # Every request is served by the healthy provider.
    assert len(results) == 20 and all(p == "gemini" for p in results)
    # Health counters must be internally consistent (no lost updates / races):
    # gemini served all 20; groq's failure count equals however many times it was
    # attempted before being demoted below the healthy provider, and must equal its
    # own call count exactly (no torn/lost updates under concurrency).
    assert r.health.get("gemini").successes == 20
    assert r.health.get("groq").failures == groq.calls


def test_timing_slow_provider_abandoned_fast():
    """The core regression: a provider that would hang for a long time must be
    abandoned at ~timeout, not block for the full hang."""
    groq = FakeProvider("groq", slow(30.0), timeout=0.5, priority=1)
    gemini = FakeProvider("gemini", ok("GEM"), priority=2)
    r = make_router([groq, gemini])
    t0 = time.monotonic()
    res = r.invoke_structured("p", str)
    elapsed = time.monotonic() - t0
    assert res.provider == "gemini"
    assert elapsed < 2.0, f"slow provider blocked for {elapsed:.2f}s"
