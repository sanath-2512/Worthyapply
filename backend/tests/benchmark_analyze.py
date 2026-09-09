"""
Regression benchmark: OLD 3-call pipeline vs NEW 1-call pipeline on identical inputs.

Runs both against a fixed dataset, comparing:
  - LLM call count (instrumented via router)
  - total latency
  - schema failures
  - grounding violations (forbidden tokens marked as matched)
  - semantic field similarity (Jaccard over normalized skill/requirement sets)

Does NOT compare raw JSON (LLM wording is nondeterministic). Does NOT log
resume/JD/prompt/key contents. Outputs a machine-readable JSON report.

Usage:
    .venv/bin/python -m backend.tests.benchmark_analyze [--limit N]
"""

from __future__ import annotations

import argparse
import json
import re
import time

from dotenv import load_dotenv
load_dotenv()

from backend import pipeline as P
from backend.tests.benchmark_data import CASES


# ------------------------------------------------------------------ instrumentation
class CallCounter:
    """Wraps the router's invoke_structured to count real LLM calls."""

    def __init__(self):
        self.count = 0
        self._orig = None

    def __enter__(self):
        from backend.llm_router import get_router
        router = get_router()
        self._orig = router.invoke_structured
        counter = self

        def wrapped(prompt, response_format, task_type=None):
            counter.count += 1
            return counter._orig(prompt, response_format, task_type=task_type)

        router.invoke_structured = wrapped
        return self

    def __exit__(self, *a):
        from backend.llm_router import get_router
        get_router().invoke_structured = self._orig


# ------------------------------------------------------------------ helpers
def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9+#.]", "", s.lower())


def _skill_set(items) -> set[str]:
    out = set()
    for it in items or []:
        n = _norm(str(it))
        if n:
            out.add(n)
    return out


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def grounding_violations(resp, forbidden: list[str], years_trap: bool) -> list[str]:
    """Forbidden tokens must not be claimed as demonstrated.

    Logic-aware: a token that appears ONLY inside an OR-group assessment (logic=or_group)
    is NOT a violation — the group is legitimately satisfied by another option. A
    violation is a token marked matched in matching_skills, or an assessment naming that
    token as its OWN matched requirement (not merely part of a satisfied OR-group).
    """
    violations = []
    ma = resp.match_analysis
    matched = _skill_set(ma.matching_skills)
    # Requirements the model claims are individually matched (excluding OR-groups).
    individually_matched = set()
    for a in getattr(ma, "requirement_assessments", []) or []:
        status = getattr(a, "match_status", None) or ("matched" if a.satisfied == "yes" else "missing")
        logic = getattr(a, "logic", "single")
        if status == "matched" and logic != "or_group":
            individually_matched.add(_norm(a.requirement))
    for tok in forbidden:
        nt = _norm(tok)
        if any(nt == m for m in matched if m):  # exact match in matching_skills
            violations.append(f"matched:{tok}")
        elif any(nt == r for r in individually_matched if r):
            violations.append(f"satisfied:{tok}")
    if years_trap:
        # Resume states no duration for the skill. Any years requirement must be
        # partial/cannot_verify/missing — NEVER matched. Flag if marked matched.
        for a in getattr(ma, "requirement_assessments", []) or []:
            req = a.requirement.lower()
            status = getattr(a, "match_status", None) or ("matched" if a.satisfied == "yes" else "missing")
            if re.search(r"\d+\+?\s*years?", req) and status == "matched":
                violations.append("years:inferred_matched")
    return violations


def field_similarity(old, new) -> dict:
    ja_old, ja_new = old.job_analysis, new.job_analysis
    ma_old, ma_new = old.match_analysis, new.match_analysis
    return {
        "job_technical_skills": round(jaccard(_skill_set(ja_old.technical_skills), _skill_set(ja_new.technical_skills)), 2),
        "job_required_skills": round(jaccard(_skill_set(ja_old.required_skills), _skill_set(ja_new.required_skills)), 2),
        "match_matching_skills": round(jaccard(_skill_set(ma_old.matching_skills), _skill_set(ma_new.matching_skills)), 2),
        "match_skill_gaps": round(jaccard(_skill_set(ma_old.skill_gaps), _skill_set(ma_new.skill_gaps)), 2),
        "match_score_absdiff": abs(ma_old.match_score - ma_new.match_score),
        "recommendation_same": ma_old.recommendation == ma_new.recommendation,
    }


def run_old(resume_text, jd):
    """3 calls."""
    with CallCounter() as cc:
        t0 = time.monotonic()
        ja = P.run_job_analysis(jd)
        mr = P.run_match_analysis(ja, resume_text)
        opt = P.run_resume_optimization(ja, mr, resume_text)
        dt = time.monotonic() - t0
        resp = P.AnalysisResponse(job_analysis=ja, match_analysis=mr, resume_optimization=opt)
    return resp, dt, cc.count


def run_new(resume_text, jd):
    """1 call."""
    with CallCounter() as cc:
        t0 = time.monotonic()
        combined = P.run_combined_analysis(jd, resume_text)
        dt = time.monotonic() - t0
        resp = P.AnalysisResponse(**combined.model_dump())
    return resp, dt, cc.count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=len(CASES))
    ap.add_argument("--out", default="benchmark_report.json")
    args = ap.parse_args()

    cases = CASES[: args.limit]
    report = {"cases": [], "summary": {}}
    agg = {
        "old_calls": 0, "new_calls": 0,
        "old_latency": 0.0, "new_latency": 0.0,
        "old_schema_fail": 0, "new_schema_fail": 0,
        "old_violations": 0, "new_violations": 0,
        "n": 0,
    }

    for c in cases:
        row = {"id": c["id"]}
        # OLD
        try:
            old_resp, old_dt, old_calls = run_old(c["resume"], c["jd"])
            old_v = grounding_violations(old_resp, c.get("forbidden_matches", []), c.get("years_trap", False))
            row["old"] = {"latency_s": round(old_dt, 2), "calls": old_calls, "violations": old_v}
            agg["old_latency"] += old_dt; agg["old_calls"] += old_calls
            agg["old_violations"] += len(old_v)
        except Exception as e:
            row["old"] = {"schema_fail": True, "error": type(e).__name__}
            agg["old_schema_fail"] += 1
            old_resp = None

        # NEW
        try:
            new_resp, new_dt, new_calls = run_new(c["resume"], c["jd"])
            new_v = grounding_violations(new_resp, c.get("forbidden_matches", []), c.get("years_trap", False))
            row["new"] = {"latency_s": round(new_dt, 2), "calls": new_calls, "violations": new_v}
            agg["new_latency"] += new_dt; agg["new_calls"] += new_calls
            agg["new_violations"] += len(new_v)
        except Exception as e:
            row["new"] = {"schema_fail": True, "error": type(e).__name__}
            agg["new_schema_fail"] += 1
            new_resp = None

        if old_resp is not None and new_resp is not None:
            row["similarity"] = field_similarity(old_resp, new_resp)
        agg["n"] += 1
        report["cases"].append(row)
        print(f"[{c['id']}] old={row.get('old')} new={row.get('new')}")

    n = max(agg["n"], 1)
    report["summary"] = {
        "n": agg["n"],
        "old_avg_calls": round(agg["old_calls"] / n, 2),
        "new_avg_calls": round(agg["new_calls"] / n, 2),
        "old_avg_latency_s": round(agg["old_latency"] / n, 2),
        "new_avg_latency_s": round(agg["new_latency"] / n, 2),
        "latency_reduction_pct": round(100 * (1 - (agg["new_latency"] / max(agg["old_latency"], 1e-9))), 1),
        "old_total_grounding_violations": agg["old_violations"],
        "new_total_grounding_violations": agg["new_violations"],
        "old_schema_failures": agg["old_schema_fail"],
        "new_schema_failures": agg["new_schema_fail"],
    }
    with open(args.out, "w") as f:
        json.dump(report, f, indent=2)
    print("\n==== SUMMARY ====")
    print(json.dumps(report["summary"], indent=2))
    print(f"\nfull report -> {args.out}")


if __name__ == "__main__":
    main()
