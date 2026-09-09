"""
Deterministic tests for the analysis-quality logic that does NOT require the LLM:
- explainable Python scoring from requirement assessments
- deterministic recommendation
- cross-field consistency post-processing (optimization must respect match analysis)
- empty-input safety

The LLM-dependent semantic behavior is exercised by benchmark_analyze.py.
"""

from backend import pipeline as P


RA = P.RequirementAssessment


def _combined(assessments, bullets=None, keywords=None, warnings=None):
    return P.CombinedAnalysis(
        job_analysis=P.JobAnalysis(
            job_title="X", company="Y", experience_required="Not mentioned",
            technical_skills=[], soft_skills=[], responsibilities=[], nice_to_have=[],
            keywords=[], summary="s",
        ),
        match_analysis=P.MatchAnalysis(
            required_skills=[], matching_skills=[], skill_gaps=[], match_score=99,
            recommendation="Apply", recommendation_reason="", requirement_assessments=assessments,
        ),
        resume_optimization=P.ResumeOptimization(
            overall_assessment="", priority_improvements=[],
            resume_bullet_improvements=bullets or [], keywords_to_include=keywords or [],
            missing_or_weak_requirements=[], warnings=warnings or [],
        ),
    )


def test_score_is_explainable_and_priority_weighted():
    score, summary = P.compute_match_score([
        RA(requirement="Python", kind="required", satisfied="yes", priority="required", match_status="matched"),
        RA(requirement="SQL", kind="required", satisfied="yes", priority="required", match_status="matched"),
        RA(requirement="Docker", kind="preferred", satisfied="no", priority="preferred", match_status="missing"),
    ])
    assert score >= 80  # both hard reqs matched, only a preferred missing
    assert "matched=2" in summary and "missing=1" in summary


def test_missing_hard_requirement_dominates():
    high_pref = [RA(requirement=f"pref{i}", kind="preferred", satisfied="yes",
                    priority="preferred", match_status="matched") for i in range(5)]
    score, summary = P.compute_match_score(
        [RA(requirement="Python", kind="required", satisfied="no", priority="required", match_status="missing")]
        + high_pref
    )
    # One missing hard requirement must keep the score from looking great despite many prefs.
    assert score < 70
    assert "Unmet hard requirements: Python" in summary


def test_cannot_verify_never_full_credit():
    score, _ = P.compute_match_score([
        RA(requirement="5+ years Python", kind="experience", satisfied="partial",
           priority="required", match_status="cannot_verify"),
    ])
    assert 0 < score < 60  # limited credit, never full


def test_recommendation_downgrades_on_hard_gap():
    assert P._recommendation_from_score(90, 0) == "Apply"
    assert P._recommendation_from_score(90, 1) == "Maybe"   # high score but a hard gap
    assert P._recommendation_from_score(30, 2) == "Do Not Apply"


def test_postprocess_recomputes_score_over_llm_value():
    c = _combined([
        RA(requirement="Python", kind="required", satisfied="no", priority="required", match_status="missing"),
    ])
    assert c.match_analysis.match_score == 99  # LLM's (wrong) value before post-process
    P._postprocess_combined(c)
    assert c.match_analysis.match_score < 99   # replaced by deterministic score
    assert c.match_analysis.recommendation in ("Maybe", "Do Not Apply")


def test_consistency_drops_unsafe_bullet_and_keyword():
    # Match says AWS is missing; optimization tries to inject AWS into a bullet + keywords.
    c = _combined(
        assessments=[RA(requirement="AWS", kind="required", satisfied="no",
                        priority="required", match_status="missing")],
        bullets=[P.BulletImprovement(original="Built APIs in Python.",
                                     improved="Built APIs in Python on AWS.", reason="jd")],
        keywords=["AWS", "Python"],
    )
    P._postprocess_combined(c)
    # The unsafe bullet (introduces AWS not in original) is removed...
    assert all("aws" not in b.improved.lower() for b in c.resume_optimization.resume_bullet_improvements)
    # ...and a warning is recorded, and AWS is stripped from keywords.
    assert any("aws" in w.lower() for w in c.resume_optimization.warnings)
    assert "AWS" not in c.resume_optimization.keywords_to_include


def test_consistency_keeps_safe_bullet():
    c = _combined(
        assessments=[RA(requirement="FastAPI", kind="required", satisfied="yes",
                        priority="required", match_status="matched")],
        bullets=[P.BulletImprovement(original="Built a web service.",
                                     improved="Built a FastAPI web service.", reason="jd")],
    )
    P._postprocess_combined(c)
    # FastAPI is matched, so surfacing it is legitimate and must be kept.
    assert len(c.resume_optimization.resume_bullet_improvements) == 1


def test_empty_assessments_scores_zero():
    score, summary = P.compute_match_score([])
    assert score == 0 and "No requirements" in summary
