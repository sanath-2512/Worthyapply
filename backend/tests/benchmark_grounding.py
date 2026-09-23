"""
Offline grounding benchmark (no network, no API keys).

The live benchmark (benchmark_analyze.py) measures the LLM. This one measures the
DETERMINISTIC layer around it: given fixed, realistic model outputs — including
adversarial ones (hallucinated matches, over-strict gaps, fabricated metrics,
invented seniority, gap-skill injection) — what reaches the user?

Scoring is implementation-independent: each fixture lists strings that must NOT
appear in the final output and strings that MUST survive (good, truthful edits),
checked by plain substring search. So the same fixtures score the old and the new
code fairly.

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
def _combined(assessments, keywords=None, bullets=None, required=None, matching=None, gaps=None):
    return P.CombinedAnalysis(
        job_analysis=P.JobAnalysis(
            job_title="Engineer", company="Co", experience_required="Not mentioned",
            technical_skills=list(required or []), soft_skills=[], responsibilities=[],
            nice_to_have=[], keywords=[], summary="role",
            required_skills=list(required or []),
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


def _ra(req, status, evidence="", priority="required"):
    return RA(requirement=req, kind="required", satisfied={"matched": "yes", "partial": "partial"}.get(status, "no"),
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
]


def _postprocess(combined, resume, jd):
    params = inspect.signature(P._postprocess_combined).parameters
    if "resume_text" in params:
        return P._postprocess_combined(combined, resume_text=resume, job_description=jd)
    return P._postprocess_combined(combined)


def run_analysis_cases():
    rows, totals = [], {"false_matches": 0, "false_gaps": 0, "keyword_misses": 0, "unsafe_keywords": 0, "checks": 0}
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
        "id": "T3_gap_injection_kubernetes",
        "why": "Kubernetes is a genuine gap — must not appear anywhere in the tailored resume.",
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
        "must_not": ["Kubernetes"],
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
        "why": "Docker only appears in a side project; claiming it at the job is misattribution.",
        "resume": _resume(experience=[("Engineer", "Acme", _ul("Maintained Python ETL scripts."))],
                          projects=[("Homelab", _ul("Containerized apps with Docker."))]),
        "jd": "Python, Docker.",
        "analysis": _analysis(["Python", "Docker"], ["Python", "Docker"], []),
        "patch": T.ResumeTailorPatch(experience_edits=[T.BulletEdit(index=0, new_description=_ul(
            "Maintained Python ETL scripts deployed with Docker."))]),
        "must_keep": ["Python ETL scripts"],
        "must_not_in_experience": ["Docker"],
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
        "why": "Adding AWS (parent of Bedrock, evidenced) is fine; Terraform (gap) is not.",
        "resume": _resume(experience=[("Engineer", "Acme", _ul("Built a chatbot on AWS Bedrock."))],
                          skills=[("Languages", "Python")]),
        "jd": "Required: AWS, Terraform.",
        "analysis": _analysis(["AWS", "Terraform"], ["AWS"], ["Terraform"]),
        "patch": T.ResumeTailorPatch(skill_edits=[T.SkillCategoryEdit(index=0, new_skills="Python, AWS, Terraform")],
                                     added_skills=["AWS", "Terraform"]),
        "must_keep": ["AWS"],
        "must_not": ["Terraform"],
    },
]


def _finalize(case):
    resume, patch, analysis, jd = case["resume"], case["patch"].model_copy(deep=True), case["analysis"], case["jd"]
    if hasattr(T, "finalize_tailoring"):
        tailored, added, _report = T.finalize_tailoring(resume, patch, analysis, jd)
        return tailored
    # Pre-change path: apply the patch and force-inject target skills, as the old streaming code did.
    tailored, _added = T._apply_patch(resume, patch, T.build_gaps_to_add(analysis))
    from backend.resume_extractor import _cleanup
    return _cleanup(tailored)


def _text(r: ExtractedResume) -> str:
    return json.dumps(r.model_dump())


def run_tailor_cases():
    rows = []
    totals = {"unsupported_claims_in_output": 0, "good_edits_lost": 0, "checks": 0}
    for c in TAILOR_CASES:
        out = _finalize(c)
        blob = _text(out)
        issues = []
        for s in c.get("must_not", []):
            totals["checks"] += 1
            if re.search(re.escape(s), blob):
                issues.append(f"unsupported_in_output:{s}"); totals["unsupported_claims_in_output"] += 1
        exp_blob = json.dumps([e.description for e in out.experience])
        for s in c.get("must_not_in_experience", []):
            totals["checks"] += 1
            if s in exp_blob:
                issues.append(f"misattributed_in_experience:{s}"); totals["unsupported_claims_in_output"] += 1
        for s in c.get("must_keep", []):
            totals["checks"] += 1
            if s not in blob:
                issues.append(f"lost:{s}"); totals["good_edits_lost"] += 1
        rows.append({"id": c["id"], "issues": issues})
    return rows, totals


# ============================================================ held-out fact-check set
# Written independently of the checker's rules (not tuned against it). Each pair is
# (original bullet, rewrite, is_legitimate). Measures how often the fact-check wrongly
# reverts a good rewrite (false positive) or lets a fabrication through (false negative).
HELDOUT = [
    # ---- legitimate rewrites (must pass)
    ("Made a website for a local bakery with React.", "Built a React website for a local bakery to showcase products and take online orders.", False),
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


def run_heldout():
    from backend import grounding as G
    fp = fn = tp = tn = 0
    misses = []
    for orig, new, ok in HELDOUT:
        flagged = bool(G.unsupported_claims(new, orig)) if hasattr(G, "unsupported_claims") else False
        if ok and flagged:
            fp += 1; misses.append(("false_positive", new, G.unsupported_claims(new, orig)))
        elif ok:
            tn += 1
        elif flagged:
            tp += 1
        else:
            fn += 1; misses.append(("false_negative", new, []))
    return {"legit": tn + fp, "fabricated": tp + fn, "false_positives": fp, "false_negatives": fn,
            "caught": tp}, misses


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
    sizes = run_prompt_sizes()
    try:
        heldout, misses = run_heldout()
    except ImportError:
        heldout, misses = {"note": "no fact-check module"}, []
    report = {"analysis": {"cases": a_rows, "totals": a_tot}, "tailoring": {"cases": t_rows, "totals": t_tot},
              "prompt_size": sizes, "heldout_factcheck": heldout,
              "heldout_misses": [list(m) for m in misses]}
    for r in a_rows + t_rows:
        print(f"[{r['id']}] {'OK' if not r['issues'] else r['issues']}")
    print("\nanalysis :", json.dumps(a_tot))
    print("tailoring:", json.dumps(t_tot))
    print("prompts  :", json.dumps(sizes))
    print("held-out :", json.dumps(heldout))
    for m in misses:
        print("   ", m)
    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    main()
