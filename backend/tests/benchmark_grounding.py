"""
Offline grounding benchmark (no network, no API keys).

The live benchmark (benchmark_analyze.py) measures the LLM. This one measures the
DETERMINISTIC layer around it: given fixed, realistic model outputs — including
adversarial ones (hallucinated matches, over-strict gaps, fabricated metrics,
invented seniority, gap-skill injection) — what reaches the user?

Scoring is implementation-independent: each fixture lists strings checked by plain
substring search against the final output (and the fact-check report), so the same
fixtures score the old and the new code fairly.

Tailoring policy measured here:
  * HARD fabrications (invented numbers, scale, outcomes, stronger ownership,
    seniority) must never reach the output.
  * SOFT additions (a missing skill, new wording) are ALLOWED — adding a JD gap is
    what lets the next analysis score higher — but each must be FLAGGED to the
    candidate. An unflagged addition is a failure.
  * No compression: every original fact (numbers, tools, bullets) must survive.
Import fidelity: nothing in the uploaded resume may be lost or shortened.

Usage:
    .venv/bin/python -m backend.tests.benchmark_grounding [--out grounding_report.json]
"""

from __future__ import annotations

import argparse
import inspect
import json
import re

from backend import pipeline as P
from backend import resume_tailor as T
from backend.resume_extractor import (
    ExtractedResume, ExperienceOut, ProjectOut, SkillCategoryOut, PersonalInfoOut,
)

RA = P.RequirementAssessment


# ============================================================ analysis fixtures
def _combined(assessments, keywords=None, bullets=None, required=None, matching=None, gaps=None, groups=None):
    return P.CombinedAnalysis(
        job_analysis=P.JobAnalysis(
            job_title="Engineer", company="Co", experience_required="Not mentioned",
            technical_skills=list(required or []), soft_skills=[], responsibilities=[],
            nice_to_have=[], keywords=[], summary="role",
            required_skills=list(required or []),
            alternative_skill_groups=[P.AlternativeSkillGroup(options=g) for g in (groups or [])],
        ),
        match_analysis=P.MatchAnalysis(
            required_skills=list(required or []), matching_skills=list(matching or []),
            skill_gaps=list(gaps or []), match_score=50, recommendation="Maybe",
            recommendation_reason="", requirement_assessments=assessments,
        ),
        resume_optimization=P.ResumeOptimization(
            overall_assessment="", priority_improvements=[],
            resume_bullet_improvements=bullets or [], keywords_to_include=keywords or [],
            missing_or_weak_requirements=[], warnings=[],
        ),
    )


def _ra(req, status, evidence="", priority="required", kind="required"):
    return RA(requirement=req, kind=kind, satisfied={"matched": "yes", "partial": "partial"}.get(status, "no"),
              priority=priority, match_status=status, evidence=evidence)


ANALYSIS_CASES = [
    {
        "id": "A1_related_parent_aws",
        "why": "JD asks AWS; resume shows AWS Bedrock + S3. Model was over-strict and said missing.",
        "resume": "ML engineer. Built an AI document Q&A system using AWS Bedrock and S3.",
        "jd": "Required: AWS, Python.",
        "combined": _combined([_ra("AWS", "missing"), _ra("Python", "missing")],
                              required=["AWS", "Python"], gaps=["AWS", "Python"]),
        "expect_matched": ["AWS"],   # related evidence (Bedrock/S3 are AWS services)
        "expect_gap": ["Python"],    # genuinely absent
    },
    {
        "id": "A2_hallucinated_kubernetes",
        "why": "Model claims Kubernetes matched; resume never mentions it.",
        "resume": "Backend developer. Python, FastAPI, Docker.",
        "jd": "Required: Python, Kubernetes.",
        "combined": _combined([_ra("Python", "matched", "Python"), _ra("Kubernetes", "matched", "container experience")],
                              required=["Python", "Kubernetes"], matching=["Python", "Kubernetes"],
                              keywords=["Kubernetes", "Python"]),
        "expect_matched": ["Python"],
        "expect_gap": ["Kubernetes"],
        "forbid_keyword": ["Kubernetes"],
    },
    {
        "id": "A3_weakly_expressed_rest",
        "why": "JD asks REST APIs; resume says 'Built FastAPI backend'. Present but weakly expressed.",
        "resume": "Software engineer. Built a FastAPI backend for an internal tool.",
        "jd": "Required: REST APIs.",
        "combined": _combined([_ra("REST APIs", "partial", "Built a FastAPI backend")],
                              required=["REST APIs"], matching=["REST APIs"]),
        "expect_matched": ["REST APIs"],
        "expect_keyword": ["REST APIs"],   # JD terminology should be surfaced for the rewrite
    },
    {
        "id": "A4_parent_does_not_prove_child",
        "why": "JD asks AWS Lambda; resume only says AWS. Model over-credits.",
        "resume": "Cloud engineer. Deployed services on AWS.",
        "jd": "Required: AWS Lambda.",
        "combined": _combined([_ra("AWS Lambda", "matched", "AWS")],
                              required=["AWS Lambda"], matching=["AWS Lambda"]),
        "expect_gap": ["AWS Lambda"],
    },
    {
        "id": "A5_false_synonym_java",
        "why": "JD asks Java; resume has JavaScript only.",
        "resume": "Frontend developer. JavaScript, React.",
        "jd": "Required: Java.",
        "combined": _combined([_ra("Java", "matched", "JavaScript")], required=["Java"], matching=["Java"]),
        "expect_gap": ["Java"],
    },
    {
        "id": "A6_true_match_kept",
        "why": "Plain correct match must not be disturbed.",
        "resume": "Data engineer. Python, PostgreSQL, Docker.",
        "jd": "Required: Python, PostgreSQL.",
        "combined": _combined([_ra("Python", "matched", "Python"), _ra("PostgreSQL", "matched", "PostgreSQL")],
                              required=["Python", "PostgreSQL"], matching=["Python", "PostgreSQL"]),
        "expect_matched": ["Python", "PostgreSQL"],
    },
    {
        "id": "A7_concept_match_kept",
        "why": "Concept requirement evidenced in prose must not be downgraded.",
        "resume": "Analyst. Trained scikit-learn classifiers to predict churn.",
        "jd": "Required: machine learning.",
        "combined": _combined([_ra("Machine Learning", "matched", "Trained scikit-learn classifiers")],
                              required=["Machine Learning"], matching=["Machine Learning"]),
        "expect_matched": ["Machine Learning"],
    },
    {
        "id": "A8_alias_postgres",
        "why": "JD says PostgreSQL, resume says Postgres; model said missing.",
        "resume": "Backend dev. Python, Postgres, Redis.",
        "jd": "Required: PostgreSQL.",
        "combined": _combined([_ra("PostgreSQL", "missing")], required=["PostgreSQL"], gaps=["PostgreSQL"]),
        "expect_matched": ["PostgreSQL"],
    },
    {
        "id": "A9_or_group_any_option",
        "why": "JD: React, Vue or Angular. Resume has Vue; model said missing.",
        "resume": "Frontend developer. Built dashboards in Vue and TypeScript.",
        "jd": "Required: React, Vue or Angular.",
        "combined": _combined([_ra("React, Vue or Angular", "missing", kind="or_group")],
                              groups=[["React", "Vue", "Angular"]]),
        "expect_status": {"React, Vue or Angular": "matched"},
        "expect_matched": ["Vue"],
    },
    {
        "id": "A10_or_group_hallucinated",
        "why": "JD: Kubernetes or ECS. Resume has neither; model claims matched.",
        "resume": "Backend developer. Python, FastAPI, Docker.",
        "jd": "Required: Kubernetes or ECS.",
        "combined": _combined([_ra("Kubernetes or ECS", "matched", "containers", kind="or_group")],
                              groups=[["Kubernetes", "ECS"]]),
        "expect_status": {"Kubernetes or ECS": "missing"},
    },
    {
        "id": "A11_years_from_dates",
        "why": "JD: 3+ years; dated roles add up to ~5 (degree years excluded). Model said cannot_verify.",
        "resume": ("EXPERIENCE\nSoftware Engineer, Acme Jan 2021 – Present\nBuilt Python services.\n"
                   "EDUCATION\nB.Tech Computer Science, XYZ University 2016 - 2020"),
        "jd": "3+ years of software development experience.",
        "combined": _combined([_ra("3+ years of software development experience", "cannot_verify", kind="experience")]),
        "expect_status": {"3+ years of software development experience": "matched"},
    },
    {
        "id": "A12_years_not_from_education",
        "why": "JD: 5+ years; the only 4-year range is the degree. Must not be counted.",
        "resume": ("EXPERIENCE\nIntern, Acme Jun 2023 - Aug 2023\nBuilt Python scripts.\n"
                   "EDUCATION\nB.Tech Computer Science, XYZ University 2019 - 2023"),
        "jd": "5+ years of experience.",
        "combined": _combined([_ra("5+ years of experience", "cannot_verify", kind="experience")]),
        "expect_status": {"5+ years of experience": "cannot_verify"},
    },
    {
        "id": "A13_degree_level",
        "why": "JD: Bachelor's in CS or related; resume has a B.Tech in CS. Model said cannot_verify.",
        "resume": "EDUCATION\nB.Tech in Computer Science, XYZ University 2016 - 2020",
        "jd": "Bachelor's degree in Computer Science or a related field.",
        "combined": _combined([_ra("Bachelor's degree in Computer Science or related field", "cannot_verify",
                                   kind="education")]),
        "expect_status": {"Bachelor's degree in Computer Science or related field": "matched"},
    },
]


def _postprocess(combined, resume, jd):
    params = inspect.signature(P._postprocess_combined).parameters
    if "resume_text" in params:
        return P._postprocess_combined(combined, resume_text=resume, job_description=jd)
    return P._postprocess_combined(combined)


def run_analysis_cases():
    rows, totals = [], {"false_matches": 0, "false_gaps": 0, "keyword_misses": 0, "unsafe_keywords": 0,
                        "wrong_status": 0, "checks": 0}
    for c in ANALYSIS_CASES:
        out = _postprocess(c["combined"].model_copy(deep=True), c["resume"], c["jd"])
        ma, opt = out.match_analysis, out.resume_optimization
        low = lambda xs: {x.lower() for x in xs}
        matched, gaps, kws = low(ma.matching_skills), low(ma.skill_gaps), low(opt.keywords_to_include)
        issues = []
        for s in c.get("expect_matched", []):
            totals["checks"] += 1
            if s.lower() not in matched:
                issues.append(f"false_gap:{s}"); totals["false_gaps"] += 1
        for s in c.get("expect_gap", []):
            totals["checks"] += 1
            if s.lower() in matched or s.lower() not in gaps:
                issues.append(f"false_match:{s}"); totals["false_matches"] += 1
        for s in c.get("expect_keyword", []):
            totals["checks"] += 1
            if s.lower() not in kws:
                issues.append(f"keyword_not_surfaced:{s}"); totals["keyword_misses"] += 1
        for s in c.get("forbid_keyword", []):
            totals["checks"] += 1
            if s.lower() in kws:
                issues.append(f"unsafe_keyword:{s}"); totals["unsafe_keywords"] += 1
        status = {a.requirement: a.match_status for a in ma.requirement_assessments}
        for req, want in c.get("expect_status", {}).items():
            totals["checks"] += 1
            if status.get(req) != want:
                issues.append(f"status:{req}={status.get(req)}!={want}"); totals["wrong_status"] += 1
        rows.append({"id": c["id"], "issues": issues, "score": ma.match_score})
    return rows, totals


# ============================================================ tailoring fixtures
def _resume(experience=(), projects=(), skills=(), title="Engineer", summary=""):
    return ExtractedResume(
        personal=PersonalInfoOut(fullName="Alex Rivera", title=title, email="a@example.com"),
        summary=summary,
        experience=[ExperienceOut(role=r, company=co, startDate="2022", description=d) for r, co, d in experience],
        projects=[ProjectOut(name=n, description=d) for n, d in projects],
        skills=[SkillCategoryOut(category=c, skills=s) for c, s in skills],
    )


def _ul(*items):
    return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def _analysis(required, matching, gaps, keywords=(), assessments=()):
    return {
        "job_analysis": {"job_title": "Engineer", "required_skills": list(required), "technical_skills": list(required)},
        "match_analysis": {
            "required_skills": list(required), "matching_skills": list(matching), "skill_gaps": list(gaps),
            "requirement_assessments": [dict(a) for a in assessments],
        },
        "resume_optimization": {
            "resume_bullet_improvements": [], "priority_improvements": [],
            "keywords_to_include": list(keywords), "missing_or_weak_requirements": list(gaps),
        },
    }


TAILOR_CASES = [
    {
        "id": "T1_good_rag_rewrite",
        "why": "User's GOOD example: reframe existing Bedrock work in the JD's RAG terms.",
        "resume": _resume(experience=[("ML Engineer", "Acme", _ul("Built an AI document Q&amp;A system using AWS Bedrock."))],
                          skills=[("Cloud", "AWS Bedrock")]),
        "jd": "Experience building RAG applications using AWS.",
        "analysis": _analysis(["RAG", "AWS"], ["RAG", "AWS"], [], keywords=["RAG", "AWS"],
                              assessments=[{"requirement": "RAG", "match_status": "partial", "priority": "required",
                                            "evidence": "Built an AI document Q&A system using AWS Bedrock"}]),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Built an AI document Q&amp;A system using AWS Bedrock, implementing retrieval-augmented generation "
            "workflows for enterprise document search."))]),
        "must_keep": ["retrieval-augmented generation"],
        "must_not": [],
    },
    {
        "id": "T2_bad_fabricated_scale_metrics",
        "why": "User's BAD example: invented scale, volume and latency metric.",
        "resume": _resume(experience=[("ML Engineer", "Acme", _ul("Built an AI document Q&amp;A system using AWS Bedrock."))]),
        "jd": "Experience building RAG applications using AWS.",
        "analysis": _analysis(["RAG", "AWS"], ["AWS"], []),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Built a production RAG platform processing 1M+ documents and reduced latency by 40%."))]),
        "must_keep": ["AWS Bedrock"],
        "must_not": ["1M", "40%", "production", "reduced latency"],
    },
    {
        "id": "T3_gap_added_with_alert",
        "why": "Kubernetes is a genuine gap: add it (so the next analysis scores it) but flag it for review.",
        "resume": _resume(experience=[("Backend Engineer", "Acme", _ul("Built internal APIs with FastAPI and Docker."))],
                          skills=[("Tools", "Python, FastAPI, Docker")]),
        "jd": "Required: Python, FastAPI, Kubernetes.",
        "analysis": _analysis(["Python", "FastAPI", "Kubernetes"], ["Python", "FastAPI"], ["Kubernetes"]),
        "patch": T.ResumeTailorPatch(
            experience_edits=[T.BulletEdit(index=0, new_description=_ul(
                "Built internal APIs with FastAPI and Docker, deployed on Kubernetes."))],
            skill_edits=[T.SkillCategoryEdit(index=0, new_skills="Python, FastAPI, Docker, Kubernetes")],
            added_skills=["Kubernetes"]),
        "must_keep": ["FastAPI", "Docker"],
        "must_add_flagged": ["Kubernetes"],
        "must_not": [],
    },
    {
        "id": "T4_title_inflation",
        "why": "Seniority invented in the headline.",
        "resume": _resume(title="ML Engineer", experience=[("ML Engineer", "Acme", _ul("Trained PyTorch models."))]),
        "jd": "Senior ML Engineer.",
        "analysis": _analysis(["PyTorch"], ["PyTorch"], []),
        "patch": T.ResumeTailorPatch(new_title="Senior ML Engineer"),
        "must_keep": ["ML Engineer"],
        "must_not": ["Senior"],
    },
    {
        "id": "T5_responsibility_escalation",
        "why": "'Assisted' upgraded to 'Led'.",
        "resume": _resume(experience=[("Intern", "Acme", _ul("Assisted in developing a React dashboard."))]),
        "jd": "Frontend role. React.",
        "analysis": _analysis(["React"], ["React"], []),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Led development of a React dashboard."))]),
        "must_keep": ["React dashboard"],
        "must_not": ["Led"],
    },
    {
        "id": "T6_good_rest_terminology",
        "why": "JD terminology for existing work (FastAPI backend → REST APIs) is legitimate.",
        "resume": _resume(experience=[("Engineer", "Acme", _ul("Built a FastAPI backend for an internal tool."))]),
        "jd": "Required: REST APIs.",
        "analysis": _analysis(["REST APIs"], ["REST APIs"], [], keywords=["REST APIs"],
                              assessments=[{"requirement": "REST APIs", "match_status": "partial", "priority": "required",
                                            "evidence": "Built a FastAPI backend"}]),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Built REST APIs with FastAPI to power an internal tool."))]),
        "must_keep": ["REST APIs with FastAPI"],
        "must_not": [],
    },
    {
        "id": "T7_cross_entry_tech_transfer",
        "why": "Docker only appears in a side project; if the job bullet claims it, the candidate must be alerted.",
        "resume": _resume(experience=[("Engineer", "Acme", _ul("Maintained Python ETL scripts."))],
                          projects=[("Homelab", _ul("Containerized apps with Docker."))]),
        "jd": "Python, Docker.",
        "analysis": _analysis(["Python", "Docker"], ["Python", "Docker"], []),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Maintained Python ETL scripts deployed with Docker."))]),
        "must_keep": ["Python ETL scripts"],
        "must_flag_if_present": ["Docker"],
        "must_not": [],
    },
    {
        "id": "T8_rewrite_drops_real_metric",
        "why": "Rewrite silently drops a real achievement (30%).",
        "resume": _resume(experience=[("Engineer", "Acme", _ul("Cut query time by 30% by adding PostgreSQL indexes."))]),
        "jd": "PostgreSQL performance.",
        "analysis": _analysis(["PostgreSQL"], ["PostgreSQL"], []),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Optimized PostgreSQL performance through indexing."))]),
        "must_keep": ["30%"],
        "must_not": [],
    },
    {
        "id": "T9_skills_surface_vs_invent",
        "why": "AWS (parent of Bedrock) is evidenced — no alert needed; Terraform (gap) is added and flagged.",
        "resume": _resume(experience=[("Engineer", "Acme", _ul("Built a chatbot on AWS Bedrock."))],
                          skills=[("Languages", "Python")]),
        "jd": "Required: AWS, Terraform.",
        "analysis": _analysis(["AWS", "Terraform"], ["AWS"], ["Terraform"]),
        "patch": T.ResumeTailorPatch(skill_edits=[T.SkillCategoryEdit(index=0, new_skills="Python, AWS, Terraform")],
                                     added_skills=["AWS", "Terraform"]),
        "must_keep": ["AWS"],
        "must_add_flagged": ["Terraform"],
        "must_not_flagged": ["AWS"],
        "must_not": [],
    },
    {
        "id": "T10_compression_merge",
        "why": "Rewrite merges three bullets into one short line, dropping a metric and a tool.",
        "resume": _resume(experience=[("Engineer", "Acme", _ul(
            "Built a Django admin for 12 warehouses.",
            "Migrated nightly jobs from cron to Airflow.",
            "Wrote pytest suites for the billing module."))]),
        "jd": "Python backend engineer.",
        "analysis": _analysis(["Python"], ["Python"], []),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Built Python backend tooling and automation."))]),
        "must_keep": ["12 warehouses", "Airflow", "pytest suites for the billing module"],
        "must_not": [],
    },
    {
        "id": "T11_plain_language_addition",
        "why": "Rewrite adds functionality in plain words ('take online orders') the source never mentions.",
        "resume": _resume(experience=[("Freelancer", "Self", _ul("Made a website for a local bakery with React."))]),
        "jd": "React developer.",
        "analysis": _analysis(["React"], ["React"], []),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Built a React website for a local bakery to showcase products and take online orders."))]),
        "must_keep": ["React website"],
        "must_flag_if_present": ["orders"],
        "must_not": [],
    },
]


def _finalize(case):
    resume, patch, analysis, jd = case["resume"], case["patch"].model_copy(deep=True), case["analysis"], case["jd"]
    if hasattr(T, "finalize_tailoring"):
        tailored, added, report = T.finalize_tailoring(resume, patch, analysis, jd)
        return tailored, report
    # Pre-change path: apply the patch and force-inject target skills, as the old streaming code did.
    tailored, _added = T._apply_patch(resume, patch, T.build_gaps_to_add(analysis))
    from backend.resume_extractor import _cleanup
    return _cleanup(tailored), {}


def _flagged_terms(report: dict) -> str:
    """Everything the candidate is alerted about, lower-cased, for substring checks."""
    parts = [a.get("added", "") for a in report.get("alerts", [])]
    parts += list(report.get("flagged_skills", [])) + list(report.get("gaps_added", []))
    return " | ".join(str(p) for p in parts).lower()


def _text(r: ExtractedResume) -> str:
    return json.dumps(r.model_dump())


def run_tailor_cases():
    rows = []
    totals = {"hard_fabrications_in_output": 0, "unflagged_additions": 0, "gaps_not_added": 0,
              "good_edits_lost": 0, "checks": 0}
    for c in TAILOR_CASES:
        out, report = _finalize(c)
        blob = _text(out)
        flagged = _flagged_terms(report)
        issues = []
        for s in c.get("must_not", []):
            totals["checks"] += 1
            if re.search(re.escape(s), blob):
                issues.append(f"hard_claim_in_output:{s}"); totals["hard_fabrications_in_output"] += 1
        for s in c.get("must_add_flagged", []):
            totals["checks"] += 1
            if s not in blob:
                issues.append(f"gap_not_added:{s}"); totals["gaps_not_added"] += 1
            elif s.lower() not in flagged:
                issues.append(f"unflagged:{s}"); totals["unflagged_additions"] += 1
        for s in c.get("must_flag_if_present", []):
            totals["checks"] += 1
            exp_blob = json.dumps([e.description for e in out.experience])
            if s in exp_blob and s.lower() not in flagged:
                issues.append(f"unflagged:{s}"); totals["unflagged_additions"] += 1
        for s in c.get("must_not_flagged", []):
            totals["checks"] += 1
            if re.search(rf"(^|\W){re.escape(s.lower())}(\W|$)", flagged):
                issues.append(f"needless_alert:{s}")
        for s in c.get("must_keep", []):
            totals["checks"] += 1
            if s not in blob:
                issues.append(f"lost:{s}"); totals["good_edits_lost"] += 1
        rows.append({"id": c["id"], "issues": issues})
    return rows, totals


# ============================================================ import fidelity fixtures
# Raw PDF text vs a lossy LLM extraction (shortened bullets, a dropped bullet, a
# section with no schema field, a Technologies line). Every listed source fact must
# be in the final import.
_RAW_IMPORT = """ALEX RIVERA
EXPERIENCE
Software Engineer, Acme Corp Jan 2021 – Present
• Built a FastAPI service for invoice processing used by 40 finance analysts across three regions.
• Migrated 120 nightly cron jobs to Airflow with retries and alerting.
• Mentored 2 junior engineers on code review practices.
Technologies: Python, FastAPI, Kafka
PUBLICATIONS
Rivera, A. Grounded retrieval for enterprise search. 2023.
LANGUAGES
Spanish (native), English (fluent)
"""

IMPORT_CASES = [
    {
        "id": "F1_lossy_extraction",
        "raw": _RAW_IMPORT,
        "extracted": ExtractedResume(
            personal=PersonalInfoOut(fullName="Alex Rivera"),
            experience=[ExperienceOut(role="Software Engineer", company="Acme Corp", startDate="Jan 2021",
                                      endDate="Present", description=_ul(
                                          "Built a FastAPI service for invoice processing.",
                                          "Migrated cron jobs to Airflow.",
                                          "Technologies: Python, FastAPI, Kafka"))]),
        "must_contain": ["40 finance analysts across three regions", "120 nightly cron jobs", "retries and alerting",
                         "Mentored 2 junior engineers", "Kafka", "Grounded retrieval for enterprise search",
                         "Spanish (native)"],
    },
]


def run_import_cases():
    from backend import resume_extractor as E
    rows, totals = [], {"source_facts_lost": 0, "checks": 0}
    for c in IMPORT_CASES:
        result = c["extracted"].model_copy(deep=True)
        if hasattr(E, "finalize_import"):
            out = E.finalize_import(result, c["raw"])
        else:
            out = E._cleanup(result)
        blob = json.dumps(out.model_dump())
        issues = []
        for s in c["must_contain"]:
            totals["checks"] += 1
            if s not in blob:
                issues.append(f"lost:{s}"); totals["source_facts_lost"] += 1
        rows.append({"id": c["id"], "issues": issues})
    return rows, totals


# ============================================================ held-out fact-check set
# Written independently of the checker's rules (not tuned against it). Each pair is
# (original bullet, rewrite, is_legitimate). Measures how often the fact-check wrongly
# reverts a good rewrite (false positive) or lets a fabrication through (false negative).
HELDOUT = [
    # ---- legitimate rewrites (must pass)
    ("Worked on backend using Django.", "Developed Django backend features for the company web platform.", True),
    ("Wrote scripts in Python to clean data.", "Wrote Python scripts to clean and normalize datasets before analysis.", True),
    ("Helped the team with testing.", "Supported the team with testing of new features before release.", True),
    ("Did data analysis in pandas and made charts.", "Analyzed data with pandas and produced charts to communicate findings.", True),
    ("Built chatbot with LangChain and OpenAI API.", "Built a chatbot using LangChain and the OpenAI API to answer user questions.", True),
    ("Created dashboards in Tableau for sales team.", "Created Tableau dashboards that gave the sales team visibility into their pipeline.", True),
    ("Cut page load time by 35% by lazy loading images.", "Reduced page load time by 35% by lazy-loading images.", True),
    ("Set up GitHub Actions for tests.", "Set up CI/CD with GitHub Actions to run tests on every pull request.", True),
    ("Used Docker to run the app locally.", "Containerized the application with Docker for consistent local development.", True),
    ("Mentored 2 interns during summer.", "Mentored 2 summer interns on the team's codebase and practices.", True),
    ("Built a REST API in Flask for the inventory app.", "Designed and built a Flask REST API for the inventory application.", True),
    # ---- fabrications (must be caught)
    ("Made a website for a local bakery with React.", "Built a React website for a local bakery to showcase products and take online orders.", False),
    ("Built a website with React.", "Built a React website serving 50,000 monthly users.", False),
    ("Worked on backend using Django.", "Led backend development using Django.", False),
    ("Wrote Python scripts to clean data.", "Wrote Python and Spark pipelines to clean data.", False),
    ("Built dashboards in Tableau.", "Built Tableau dashboards that increased sales by 20%.", False),
    ("Helped deploy the app.", "Deployed the app to production on AWS.", False),
    ("Built a chatbot with LangChain.", "Built a production-grade chatbot with LangChain used by millions.", False),
    ("Assisted with database migration.", "Architected the database migration to PostgreSQL.", False),
    ("Created a to-do app in Vue.", "Created a to-do app in Vue and TypeScript, improving productivity for the team.", False),
    ("Worked on ML model for churn.", "Built a PyTorch churn model that reduced churn.", False),
    ("Contributed to the mobile app.", "Owned the mobile app roadmap and delivery.", False),
    ("Automated reports with Python.", "Automated reports with Python, saving 10 hours per week.", False),
    ("Built an internal API.", "Built a high-traffic internal API on Kubernetes.", False),
]


# Second held-out set, written after the wording check was tuned on HELDOUT above and
# never used for tuning — the honest estimate for the soft "new wording" alerts.
HELDOUT_2 = [
    ("Built an Android app in Kotlin for tracking workouts.", "Developed a Kotlin Android app that lets users track their workouts.", True),
    ("Maintained the company blog on WordPress.", "Maintained and updated the company's WordPress blog.", True),
    ("Wrote SQL queries for monthly reports.", "Wrote SQL queries to generate monthly business reports.", True),
    ("Fixed bugs in the React frontend.", "Diagnosed and fixed bugs in the React frontend.", True),
    ("Trained a CNN in TensorFlow to classify X-ray images.", "Trained a TensorFlow CNN to classify chest X-ray images.", True),
    ("Built an ETL job in Airflow that loads sales data into BigQuery.", "Built an Airflow ETL pipeline loading sales data into BigQuery.", True),
    ("Configured Nginx as a reverse proxy.", "Configured Nginx as a reverse proxy for the web services.", True),
    ("Wrote unit tests with Jest for the checkout flow.", "Added Jest unit tests covering the checkout flow.", True),
    ("Built a Slack bot in Python that posts standup reminders.", "Built a Python Slack bot that posts daily standup reminders to the team.", True),
    ("Translated designs from Figma into HTML and CSS.", "Implemented Figma designs as responsive HTML/CSS pages.", True),
    ("Built an Android app in Kotlin for tracking workouts.", "Built a Kotlin Android app for tracking workouts with Firebase sync and push notifications.", False),
    ("Maintained the company blog on WordPress.", "Maintained the company blog on WordPress, growing traffic by 3x.", False),
    ("Wrote SQL queries for monthly reports.", "Designed the data warehouse and wrote SQL for monthly reports.", False),
    ("Fixed bugs in the React frontend.", "Owned the React frontend and fixed bugs.", False),
    ("Trained a CNN in TensorFlow to classify X-ray images.", "Trained a TensorFlow CNN deployed in hospitals to classify X-ray images.", False),
    ("Configured Nginx as a reverse proxy.", "Configured Nginx load balancing across 8 servers.", False),
    ("Wrote unit tests with Jest for the checkout flow.", "Wrote Jest and Cypress tests for the checkout flow.", False),
    ("Built a Slack bot in Python that posts standup reminders.", "Built a Python Slack bot that posts standup reminders and summarizes tickets with GPT.", False),
]


def run_heldout(pairs=None):
    """For legitimate rewrites: how often the check would REMOVE them (hard false
    positive) and how often it merely alerts (soft noise). For fabrications: caught
    when reported at all — as a hard claim (removed) or a soft one (kept, alerted)."""
    from backend import grounding as G

    def claims(new, orig):
        if hasattr(G, "classify_claims"):
            return G.classify_claims(new, orig)
        return [{"severity": "hard", "kind": "claim", "text": m}
                for m in (G.unsupported_claims(new, orig) if hasattr(G, "unsupported_claims") else [])]

    res = {"legit": 0, "fabricated": 0, "false_positives_removed": 0, "legit_alerted": 0,
           "caught_removed": 0, "caught_alerted": 0, "false_negatives": 0}
    misses = []
    for orig, new, ok in (HELDOUT if pairs is None else pairs):
        found = claims(new, orig)
        hard = [c for c in found if c["severity"] == "hard"]
        desc = [f"{c['severity']}:{c['kind']}:{c['text']}" for c in found]
        if ok:
            res["legit"] += 1
            if hard:
                res["false_positives_removed"] += 1; misses.append(("false_positive", new, desc))
            elif found:
                res["legit_alerted"] += 1; misses.append(("alert_on_legit", new, desc))
        else:
            res["fabricated"] += 1
            if hard:
                res["caught_removed"] += 1
            elif found:
                res["caught_alerted"] += 1
            else:
                res["false_negatives"] += 1; misses.append(("false_negative", new, []))
    return res, misses


# ============================================================ prompt size
# Token usage is not exposed by the structured-output path, but prompt INPUT size is
# deterministic, so it is measured exactly (chars) and estimated as tokens (chars/4).
def _sample_analysis():
    return {
        "job_analysis": {
            "job_title": "Senior Frontend Engineer", "company": "Northwind", "experience_required": "4+ years",
            "technical_skills": ["React", "TypeScript", "Next.js", "GraphQL", "Jest", "Kubernetes", "CSS"],
            "soft_skills": ["Communication", "Mentoring"],
            "responsibilities": [f"Responsibility number {i} described in a full sentence." for i in range(8)],
            "nice_to_have": ["Three.js", "Storybook"], "keywords": ["React", "TypeScript", "performance"],
            "summary": "A senior frontend role focused on performant, accessible product UI." * 2,
            "required_skills": ["React", "TypeScript", "GraphQL", "Kubernetes"],
        },
        "match_analysis": {
            "required_skills": ["React", "TypeScript", "GraphQL", "Kubernetes"],
            "matching_skills": ["React", "TypeScript"], "skill_gaps": ["GraphQL", "Kubernetes"],
            "match_score": 70, "recommendation": "Maybe", "recommendation_reason": "Solid core stack." * 3,
            "requirement_assessments": [
                {"requirement": r, "kind": "required", "satisfied": "yes", "priority": "required",
                 "match_status": st, "evidence": "Evidence sentence quoted from the resume for this item.",
                 "evidence_source": "professional", "what_missing": "", "points_awarded": 0, "max_points": 10}
                for r, st in [("React", "matched"), ("TypeScript", "matched"), ("GraphQL", "missing"), ("Kubernetes", "missing")]
            ],
            "scoring_summary": "Score derived from weighted requirements." * 3,
        },
        "resume_optimization": {
            "overall_assessment": "Good fit overall with some gaps." * 3,
            "priority_improvements": ["Quantify impact where the resume states it", "Name TypeScript explicitly"],
            "resume_bullet_improvements": [
                {"original": "Built UI components.", "improved": "Built reusable React UI components.", "reason": "Names stack."}
            ],
            "keywords_to_include": ["React", "TypeScript"],
            "missing_or_weak_requirements": ["GraphQL", "Kubernetes"],
            "warnings": ["Do not claim Kubernetes."],
        },
    }


def run_prompt_sizes():
    from backend.tests.benchmark_data import CASES
    combined = [len(P._combined_analysis_prompt(c["jd"], c["resume"])) for c in CASES]
    resume = _resume(experience=[("Frontend Engineer", "Acme", _ul(*[f"Bullet {i} about React work." for i in range(5)]))],
                     skills=[("Frontend", "React, TypeScript, CSS")], summary="Frontend engineer.")
    analysis = _sample_analysis()
    jd = "Senior Frontend Engineer. React, TypeScript, GraphQL, Kubernetes. " * 6
    if hasattr(T, "build_tailor_prompt"):
        tailor = len(T.build_tailor_prompt(resume, jd, analysis))
    else:
        tailor = len(T._tailoring_prompt(
            json.dumps(resume.model_dump()), jd, json.dumps(analysis),
            T._format_checklist(T.build_recommendation_checklist(analysis)), T.build_gaps_to_add(analysis)))
    avg_combined = round(sum(combined) / len(combined))
    return {
        "combined_prompt_avg_chars": avg_combined, "combined_prompt_avg_tokens_est": avg_combined // 4,
        "tailor_prompt_chars": tailor, "tailor_prompt_tokens_est": tailor // 4,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="grounding_report.json")
    args = ap.parse_args()
    a_rows, a_tot = run_analysis_cases()
    t_rows, t_tot = run_tailor_cases()
    f_rows, f_tot = run_import_cases()
    sizes = run_prompt_sizes()
    try:
        heldout, misses = run_heldout()
        heldout2, misses2 = run_heldout(HELDOUT_2)
    except ImportError:
        heldout, misses = {"note": "no fact-check module"}, []
        heldout2, misses2 = {"note": "no fact-check module"}, []
    report = {"analysis": {"cases": a_rows, "totals": a_tot}, "tailoring": {"cases": t_rows, "totals": t_tot},
              "import_fidelity": {"cases": f_rows, "totals": f_tot},
              "prompt_size": sizes, "heldout_factcheck": heldout,
              "heldout_misses": [list(m) for m in misses],
              "heldout2_factcheck": heldout2, "heldout2_misses": [list(m) for m in misses2]}
    for r in a_rows + t_rows + f_rows:
        print(f"[{r['id']}] {'OK' if not r['issues'] else r['issues']}")
    print("\nanalysis :", json.dumps(a_tot))
    print("tailoring:", json.dumps(t_tot))
    print("import   :", json.dumps(f_tot))
    print("prompts  :", json.dumps(sizes))
    print("held-out :", json.dumps(heldout))
    for m in misses:
        print("   ", m)
    print("held-out2:", json.dumps(heldout2))
    for m in misses2:
        print("   ", m)
    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    main()
