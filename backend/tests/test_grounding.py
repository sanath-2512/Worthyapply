"""
Deterministic tests for evidence handling and the tailoring fact-check (no network).
"""

from backend import grounding as G
from backend import pipeline as P
from backend import resume_tailor as T
from backend import skills as S
from backend.resume_extractor import ExtractedResume, ExperienceOut, ProjectOut, SkillCategoryOut, PersonalInfoOut


# ---------------------------------------------------------------- skills.py
def test_child_proves_parent_not_reverse():
    assert S.support_for("AWS", "Built a Q&A system on AWS Bedrock and S3") == "related:aws bedrock"
    assert S.support_for("AWS Lambda", "Deployed services on AWS.") is None


def test_aliases_and_false_synonyms():
    assert S.support_for("PostgreSQL", "Python, Postgres") == "direct"
    assert S.support_for("Kubernetes", "Ran workloads on K8s") == "direct"
    assert S.support_for("Java", "JavaScript and React") is None
    assert S.support_for("React", "React Native apps") is None


def test_ambiguous_words_are_not_skills():
    assert S.find_skills("the rest of the team, express delivery, spring 2023, we go live") == set()


# ---------------------------------------------------------------- analysis verification
def _combined(assessments, **opt):
    return P.CombinedAnalysis(
        job_analysis=P.JobAnalysis(job_title="E", company="C", experience_required="-", technical_skills=[],
                                   soft_skills=[], responsibilities=[], nice_to_have=[], keywords=[], summary="s",
                                   required_skills=[a.requirement for a in assessments]),
        match_analysis=P.MatchAnalysis(required_skills=[a.requirement for a in assessments], matching_skills=[],
                                       skill_gaps=[], match_score=0, recommendation="Maybe",
                                       recommendation_reason="", requirement_assessments=assessments),
        resume_optimization=P.ResumeOptimization(
            overall_assessment="", priority_improvements=[], resume_bullet_improvements=opt.get("bullets", []),
            keywords_to_include=opt.get("keywords", []), missing_or_weak_requirements=[], warnings=[]),
    )


def _ra(req, status, evidence="", kind="required"):
    return P.RequirementAssessment(requirement=req, kind=kind, satisfied="no", priority="required",
                                   match_status=status, evidence=evidence)


def test_related_evidence_upgrades_overstrict_gap():
    c = P._postprocess_combined(_combined([_ra("AWS", "missing")]), resume_text="Built on AWS Bedrock and S3.")
    a = c.match_analysis.requirement_assessments[0]
    assert a.match_status == "matched" and a.evidence_strength == "related"
    assert "AWS" in c.match_analysis.matching_skills
    assert "AWS" in c.resume_optimization.keywords_to_include


def test_hallucinated_tool_match_is_downgraded():
    c = P._postprocess_combined(_combined([_ra("Kubernetes", "matched", "containers")], keywords=["Kubernetes"]),
                                resume_text="Python, FastAPI, Docker.")
    assert c.match_analysis.requirement_assessments[0].match_status == "missing"
    assert "Kubernetes" in c.match_analysis.skill_gaps
    assert "Kubernetes" not in c.resume_optimization.keywords_to_include


def test_implicit_evidence_is_surfaced_as_weakly_expressed():
    c = P._postprocess_combined(_combined([_ra("REST APIs", "partial", "Built a FastAPI backend")]),
                                resume_text="Built a FastAPI backend for an internal tool.")
    a = c.match_analysis.requirement_assessments[0]
    assert a.evidence_strength == "implicit"
    assert any("job's words" in p for p in c.resume_optimization.priority_improvements)


def test_case_sensitive_skill_reconciles_as_matched():
    c = P._postprocess_combined(_combined([_ra("Go", "matched", "Go")]), resume_text="Backend services in Go and Rust.")
    assert c.match_analysis.matching_skills == ["Go"] and c.match_analysis.skill_gaps == []


def test_years_requirements_left_to_model():
    c = P._postprocess_combined(_combined([_ra("5+ years Python", "cannot_verify", kind="experience")]),
                                resume_text="Python developer.")
    assert c.match_analysis.requirement_assessments[0].match_status == "cannot_verify"


def test_suggested_rewrite_with_invented_metric_is_dropped():
    bullets = [P.BulletImprovement(original="Built a FastAPI backend.",
                                   improved="Built a FastAPI backend serving 1M requests/day.", reason="")]
    c = P._postprocess_combined(_combined([], bullets=bullets), resume_text="Built a FastAPI backend.")
    assert c.resume_optimization.resume_bullet_improvements == []
    assert any("1" in w for w in c.resume_optimization.warnings)


def test_postprocess_without_resume_text_is_unchanged_behavior():
    # Legacy callers (no resume_text) keep the previous deterministic behaviour.
    c = P._postprocess_combined(_combined([_ra("Kubernetes", "matched", "x")]))
    assert c.match_analysis.requirement_assessments[0].match_status == "matched"


# ---------------------------------------------------------------- grounding.py
def test_claim_checks():
    src = "Assisted in building an AI document Q&A system using AWS Bedrock."
    assert G.unsupported_claims("Built an AI document Q&A system on AWS Bedrock.", src) == []
    bad = G.unsupported_claims("Led a production RAG platform for 1M+ documents that reduced latency by 40%.", src)
    text = " ".join(bad)
    for token in ("1", "40", "production", "latency", "Led", "RAG"):
        assert token in text


def test_licensed_concept_allows_jd_terminology():
    src = "Built a FastAPI backend."
    assert G.unsupported_claims("Built REST APIs with FastAPI.", src) == []          # via hierarchy
    assert G.unsupported_claims("Built a RAG service.", src)                         # not licensed
    assert G.unsupported_claims("Built a RAG service.", src, {"rag"}) == []          # licensed


def test_lost_facts_ignores_concept_rewording():
    assert G.lost_facts("<li>Built a FastAPI backend, cut time 30%.</li>", "<li>Built REST APIs with FastAPI.</li>") == ["number '30'"]


# ---------------------------------------------------------------- tailoring
def _resume():
    return ExtractedResume(
        personal=PersonalInfoOut(fullName="A", title="Engineer"),
        experience=[ExperienceOut(role="Engineer", company="Acme",
                                  description="<ul><li>Built internal APIs with FastAPI.</li><li>Cut costs 20%.</li></ul>")],
        projects=[ProjectOut(name="Homelab", description="<ul><li>Ran apps in Docker.</li></ul>")],
        skills=[SkillCategoryOut(category="Languages", skills="Python")],
    )


ANALYSIS = {
    "job_analysis": {"required_skills": ["Python", "Docker", "Kubernetes", "REST APIs"]},
    "match_analysis": {"required_skills": ["Python", "Docker", "Kubernetes", "REST APIs"],
                       "matching_skills": ["Python", "Docker", "REST APIs"], "skill_gaps": ["Kubernetes"],
                       "requirement_assessments": [{"requirement": "Kubernetes", "match_status": "missing"}]},
    "resume_optimization": {"keywords_to_include": ["REST APIs", "Kubernetes"],
                            "priority_improvements": ["Add Kubernetes to your skills", "Lead with the Acme role"]},
}


def test_gaps_never_become_instructions():
    checklist = T.build_recommendation_checklist(ANALYSIS, "Built internal APIs with FastAPI. Docker.")
    assert not any("kubernetes" in c.lower() for c in checklist)
    assert "Kubernetes" in T.build_do_not_claim(ANALYSIS, "Built internal APIs with FastAPI. Docker.")


def test_finalize_keeps_truthful_edit_and_surfaces_evidenced_skill():
    patch = T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=
        "<ul><li>Built internal REST APIs with FastAPI.</li><li>Cut costs 20%.</li></ul>")])
    tailored, added, report = T.finalize_tailoring(_resume(), patch, ANALYSIS)
    assert "REST APIs with FastAPI" in tailored.experience[0].description
    assert "Docker" in added                 # evidenced in a project, not yet listed
    assert "Kubernetes" not in str(tailored.model_dump())
    assert report["reverted"] == []


def test_finalize_reverts_fabrication_and_strips_gap_skills():
    patch = T.ResumeTailorPatch(
        experience_edits=[T.BulletEdit(index=0, new_description=
            "<ul><li>Led Kubernetes-based APIs serving millions with FastAPI.</li><li>Cut costs 20%.</li></ul>")],
        skill_edits=[T.SkillCategoryEdit(index=0, new_skills="Python, Kubernetes")],
        new_title="Senior Engineer",
    )
    tailored, added, report = T.finalize_tailoring(_resume(), patch, ANALYSIS)
    dump = str(tailored.model_dump())
    assert "Kubernetes" not in dump and "millions" not in dump and "Senior" not in dump
    assert tailored.experience[0].description == _resume().experience[0].description
    assert "Kubernetes" in report["removed_skills"]
    assert {r["section"] for r in report["reverted"]} >= {"experience", "title"}


def test_recommendations_report_honestly():
    recs = T._reconcile_recommendations(
        ["Rewrite X", "Reorder"],
        [T.RecommendationResult(id=1, recommendation="Rewrite X", status="implemented", section="experience", change="done"),
         T.RecommendationResult(id=2, recommendation="Reorder", status="not_implemented", reason="already ordered")],
        ["Kubernetes"],
    )
    assert [r["status"] for r in recs] == ["implemented", "not_implemented", "not_implemented"]
    assert "left out" in recs[2]["reason"]
