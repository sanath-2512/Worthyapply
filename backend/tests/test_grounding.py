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


def test_gaps_are_added_with_alert_instruction():
    text = "Built internal APIs with FastAPI. Docker."
    checklist = T.build_recommendation_checklist(ANALYSIS, text)
    assert any("Kubernetes" in c and "flagged" in c for c in checklist)
    assert T.build_skill_gaps(ANALYSIS, text) == ["Kubernetes"]


def test_finalize_adds_gap_skill_and_flags_it():
    patch = T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=
        "<ul><li>Built internal REST APIs with FastAPI.</li><li>Cut costs 20%.</li></ul>")])
    tailored, added, report = T.finalize_tailoring(_resume(), patch, ANALYSIS)
    assert "REST APIs with FastAPI" in tailored.experience[0].description
    assert "Docker" in added and "Kubernetes" in added          # evidenced + gap
    assert report["flagged_skills"] == ["Kubernetes"]            # only the gap needs review
    assert report["removed"] == [] and report["restored"] == []


def test_finalize_keeps_soft_claims_with_alert_and_removes_hard_ones():
    patch = T.ResumeTailorPatch(
        experience_edits=[T.BulletEdit(index=0, new_description=
            "<ul><li>Built internal APIs with FastAPI, deployed on Kubernetes.</li>"
            "<li>Led a team that cut costs 20% for millions of users.</li></ul>")],
        new_title="Senior Engineer",
    )
    tailored, added, report = T.finalize_tailoring(_resume(), patch, ANALYSIS)
    desc = tailored.experience[0].description
    assert "deployed on Kubernetes" in desc                       # soft: kept...
    assert any(a["added"] == "Kubernetes" for a in report["alerts"])   # ...and alerted
    assert "millions" not in desc and "Led" not in desc          # hard: removed
    assert "Cut costs 20%." in desc                               # original restored
    assert tailored.personal.title == "Engineer"                  # seniority not invented


def test_no_compression_restores_merged_or_dropped_bullets():
    patch = T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=
        "<ul><li>Built APIs.</li></ul>")])                        # merged + dropped detail
    tailored, _, report = T.finalize_tailoring(_resume(), patch, ANALYSIS)
    desc = tailored.experience[0].description
    assert "FastAPI" in desc and "20%" in desc
    assert report["restored"]


def test_recommendations_report_honestly():
    recs = T._reconcile_recommendations(
        ["Rewrite X", "Reorder"],
        [T.RecommendationResult(id=1, recommendation="Rewrite X", status="implemented", section="experience", change="done"),
         T.RecommendationResult(id=2, recommendation="Reorder", status="not_implemented", reason="already ordered")],
        ["Kubernetes"],
    )
    assert [r["status"] for r in recs] == ["implemented", "not_implemented", "implemented"]
    assert "confirm" in recs[2]["change"]


# ---------------------------------------------------------------- OR-groups / years / degree
RESUME_DATED = """EXPERIENCE
Software Engineer, Acme Jan 2020 – Present
Built services in Python and Vue.
Intern, Beta 06/2018 - 12/2018
EDUCATION
B.Tech in Computer Science, XYZ University 2014 - 2018
"""


def test_or_group_satisfied_by_any_option():
    a = _ra("React, Vue or Angular", "missing", kind="or_group")
    c = P._postprocess_combined(_combined([a]), resume_text=RESUME_DATED)
    r = c.match_analysis.requirement_assessments[0]
    assert r.match_status == "matched" and "Vue" in r.evidence


def test_or_group_hallucinated_match_is_downgraded():
    a = _ra("Kubernetes or ECS", "matched", "containers", kind="or_group")
    c = P._postprocess_combined(_combined([a]), resume_text=RESUME_DATED)
    assert c.match_analysis.requirement_assessments[0].match_status == "missing"


def test_general_years_counted_from_dated_roles_excluding_education():
    from backend import requirement_checks as R
    import datetime as d
    assert R.total_years(RESUME_DATED, d.date(2026, 1, 1)) == 6.7   # 73 + 7 months (inclusive), not the degree years
    c = P._postprocess_combined(_combined([_ra("5+ years of software development", "cannot_verify", kind="experience")]),
                                resume_text=RESUME_DATED)
    assert c.match_analysis.requirement_assessments[0].match_status == "matched"


def test_skill_years_only_partial_and_never_lowered():
    c = P._postprocess_combined(_combined([_ra("5+ years Python", "missing", kind="experience"),
                                           _ra("15+ years Python", "matched", kind="experience")]),
                                resume_text=RESUME_DATED)
    a, b = c.match_analysis.requirement_assessments
    assert a.match_status == "partial" and a.what_missing
    assert b.match_status == "matched"                           # upgrade-only


def test_degree_level_and_field():
    from backend import requirement_checks as R
    assert R.degree_check("Bachelor's degree in Computer Science or related field", RESUME_DATED) == "matched"
    assert R.degree_check("Master's degree in Computer Science", RESUME_DATED) is None
    assert R.degree_check("Bachelor's degree in Finance", RESUME_DATED) == "partial"
    assert R.degree_level("we will be happy to hear from you") == 0
    c = P._postprocess_combined(_combined([_ra("Bachelor's degree in CS or related", "cannot_verify", kind="education")]),
                                resume_text=RESUME_DATED)
    assert c.match_analysis.requirement_assessments[0].match_status == "matched"


# ---------------------------------------------------------------- import fidelity
RAW = """JANE DOE
EXPERIENCE
Software Engineer, Acme Corp Jan 2021 – Present
• Built a FastAPI service for invoice processing used by 40 finance analysts across three regions.
• Mentored 2 junior engineers.
PUBLICATIONS
Rivera, A. and Doe, J. Grounded retrieval for enterprise search, 2023.
"""


def _imported(bullets):
    from backend.fidelity import restore_fidelity
    from backend.resume_extractor import ExperienceOut as E
    r = ExtractedResume(personal=PersonalInfoOut(fullName="Jane Doe"),
                        experience=[E(role="Software Engineer", company="Acme Corp", description=G.to_ul(bullets))])
    return restore_fidelity(r, RAW)


def test_import_restores_shortened_bullets_and_recovers_missing():
    out, report = _imported(["Built a FastAPI service for invoice processing."])
    desc = out.experience[0].description
    assert "40 finance analysts across three regions" in desc      # shortened -> original wording
    assert "Mentored 2 junior engineers." in desc                  # missing bullet -> its own entry
    assert out.activities and "Grounded retrieval" in out.activities[-1].description
    assert "Software Engineer, Acme Corp" not in out.activities[-1].description   # header not duplicated
    assert report["restored_bullets"] == 1


def test_import_fidelity_is_idempotent_on_complete_extraction():
    full = ["Built a FastAPI service for invoice processing used by 40 finance analysts across three regions.",
            "Mentored 2 junior engineers."]
    out, _ = _imported(full)
    from backend.fidelity import restore_fidelity
    again, report = restore_fidelity(out, RAW)
    assert report == {"restored_bullets": 0, "recovered_segments": []}
    assert again == out


def test_cleanup_moves_technologies_line_instead_of_deleting():
    from backend.resume_extractor import _cleanup, ExperienceOut as E
    r = ExtractedResume(experience=[E(role="Dev", company="X", technologies="Python",
                                      description="<ul><li>Built things.</li><li>Technologies: Docker, Python</li></ul>")])
    e = _cleanup(r).experience[0]
    assert "Docker" in e.technologies and "Python" in e.technologies
    assert "Technologies" not in e.description
