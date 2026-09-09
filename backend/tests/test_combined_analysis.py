"""
Reliability tests for the 1-call combined analysis path (no network).

Covers: invalid structured output -> router fallback; provider timeout -> fallback;
AnalysisResponse shape identical; combined schema validates. Uses fake providers on a
router instance injected into run_combined_analysis via the router singleton override.
"""

import time

import pytest

from backend import pipeline as P
from backend.llm_router.config import LLMConfig, ProviderSettings
from backend.llm_router.errors import SchemaValidationError
from backend.llm_router.health import HealthRegistry
from backend.llm_router.providers import LLMProvider
from backend.llm_router.router import ProviderRouter


class _R:
    def __init__(self, fn):
        self._fn = fn

    def invoke(self, prompt):
        return self._fn()


class FakeProvider(LLMProvider):
    def __init__(self, name, behavior, timeout=1.0, priority=1):
        super().__init__(ProviderSettings(name, timeout, priority))
        self.model = f"fake-{name}"
        self._behavior = behavior

    def is_configured(self):
        return True

    def _api_key(self):
        return "x"

    def build_structured(self, response_format):
        return _R(lambda: self._behavior(response_format))


def _make_router(providers):
    cfg = LLMConfig.from_env()
    cfg.circuit_cooldown_seconds = 0.3
    cfg.cooldown_timeout = 0.3
    cfg.providers = {p.name: ProviderSettings(p.name, p.timeout, p.priority) for p in providers}
    r = ProviderRouter(config=cfg)
    r.providers = {p.name: p for p in providers}
    r.health = HealthRegistry(cfg, [p.name for p in providers])
    return r


def _valid_combined(schema):
    # Minimal valid CombinedAnalysis instance.
    return P.CombinedAnalysis(
        job_analysis=P.JobAnalysis(
            job_title="Engineer", company="X", experience_required="Not mentioned",
            technical_skills=["Python"], soft_skills=[], responsibilities=[],
            nice_to_have=[], keywords=["Python"], summary="role",
        ),
        match_analysis=P.MatchAnalysis(
            required_skills=["Python"], matching_skills=["Python"], skill_gaps=[],
            match_score=80, recommendation="Apply", recommendation_reason="fit",
        ),
        resume_optimization=P.ResumeOptimization(
            overall_assessment="ok", priority_improvements=[],
            resume_bullet_improvements=[], keywords_to_include=[],
            missing_or_weak_requirements=[], warnings=[],
        ),
    )


def _patch_router(monkeypatch, router):
    import backend.llm_router as pkg
    monkeypatch.setattr(pkg, "_router", router, raising=False)
    monkeypatch.setattr(pkg, "get_router", lambda: router)


def test_combined_one_call_success(monkeypatch):
    groq = FakeProvider("groq", _valid_combined, priority=1)
    _patch_router(monkeypatch, _make_router([groq]))
    result = P.run_combined_analysis("JD: Python", "Resume: Python")
    assert isinstance(result, P.CombinedAnalysis)
    resp = P.AnalysisResponse(**result.model_dump())
    assert resp.match_analysis.recommendation == "Apply"


def test_invalid_output_triggers_fallback(monkeypatch):
    def bad(schema):
        return None  # invalid -> SchemaValidationError inside router
    groq = FakeProvider("groq", bad, priority=1)
    gemini = FakeProvider("gemini", _valid_combined, priority=2)
    _patch_router(monkeypatch, _make_router([groq, gemini]))
    result = P.run_combined_analysis("JD", "Resume")
    assert isinstance(result, P.CombinedAnalysis)  # gemini rescued it


def test_provider_timeout_triggers_fallback(monkeypatch):
    def hang(schema):
        time.sleep(5.0)
        return _valid_combined(schema)
    groq = FakeProvider("groq", hang, timeout=0.3, priority=1)
    gemini = FakeProvider("gemini", _valid_combined, priority=2)
    _patch_router(monkeypatch, _make_router([groq, gemini]))
    t0 = time.monotonic()
    result = P.run_combined_analysis("JD", "Resume")
    elapsed = time.monotonic() - t0
    assert isinstance(result, P.CombinedAnalysis)
    assert elapsed < 2.0, f"blocked {elapsed:.2f}s on hung provider"


def test_analysis_response_shape_identical():
    # The public shape must match the legacy 3-call response exactly.
    assert set(P.AnalysisResponse.model_fields) == {
        "job_analysis", "match_analysis", "resume_optimization"
    }
    assert set(P.CombinedAnalysis.model_fields) == set(P.AnalysisResponse.model_fields)
