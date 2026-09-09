# Design — Collapse the 3-call Analyze Pipeline into 1 Combined Call

## 0. Correction to the task's premise (verified in code)

The task assumes the 3 calls are: extract resume (LLM) + extract JD (LLM) + analyze.
**That is not this codebase.** The `/api/analyze` pipeline (`backend/pipeline.py
run_full_pipeline` / `run_full_pipeline_streaming`) does:

```
resume_text = PyPDF extraction        # deterministic, NO LLM
CALL#1 run_job_analysis(jd)                 -> JobAnalysis
CALL#2 run_match_analysis(JobAnalysis, resume_text) -> MatchAnalysis   # needs #1
CALL#3 run_resume_optimization(JobAnalysis, MatchAnalysis, resume_text) -> ResumeOptimization  # needs #1+#2
AnalysisResponse(job_analysis, match_analysis, resume_optimization)
```

- The LLM `extract_resume` in `resume_extractor.py` belongs to a DIFFERENT feature
  (`/api/extract-resume`, resume-builder import) and is out of scope here.
- No resume-reuse cache exists in the analyze flow, so the task's "Option B" (extract
  once, reuse across many JDs) does not apply.

## 1. Decision: Option A — ONE combined LLM call

Collapse CALL#1+#2+#3 into a single structured call:

```
resume_text + job_description
      -> ProviderRouter (one structured call)
      -> CombinedAnalysis  (contains job_analysis, match_analysis, resume_optimization)
      -> assemble AnalysisResponse in Python  (identical shape)
```

Rationale it's safe:
- All three outputs derive from the SAME two raw inputs; the sequential split was an
  authoring choice, not a data dependency that requires separate calls.
- The final API contract (`AnalysisResponse`) is unchanged -> no frontend change.
- Validation + fallback come from the existing provider router.

Why NOT 2 calls: there is no resume reuse/caching in this flow, and resume text is not
LLM-extracted, so a separate resume-extraction call would add latency for no reuse
benefit.

## 2. Schema strategy — REUSE, don't invent

Keep the existing `JobAnalysis`, `MatchAnalysis`, `ResumeOptimization` schemas exactly
(they are load-bearing for the frontend and the tailoring agent). Add ONE wrapper:

```python
class CombinedAnalysis(BaseModel):
    job_analysis: JobAnalysis
    match_analysis: MatchAnalysis
    resume_optimization: ResumeOptimization
```

`AnalysisResponse` already has exactly these three fields, so assembly is a direct copy
(`AnalysisResponse(**combined.model_dump())`). No frontend/type changes.

Deterministic-in-Python note: the existing schemas already carry counts implicitly
(frontend computes `.length`); nothing new needs LLM-side counting. No deterministic
work is currently done by the LLM that we can move out, beyond what's already in Python.

## 3. Prompt strategy

New single prompt `_combined_analysis_prompt(job_description, resume_text)` that folds in
the THREE existing prompts' rules, section-structured, with a strengthened grounding
preamble:

- Two authoritative sources: SOURCE A = RESUME, SOURCE B = JOB DESCRIPTION.
- Produce job_analysis (JD structuring rules from `_job_analysis_prompt`),
  then match_analysis (evidence-based, OR-group/required-vs-preferred, explainable
  scoring rules from `_match_analysis_prompt`),
  then resume_optimization (truthful improvement rules from `_resume_optimization_prompt`).
- Hard anti-fabrication block: never invent skills/experience/years/projects/certs/
  metrics; never upgrade "familiar with X" to "expert"; mark matched/partial/missing by
  evidence; use empty/None when no evidence.
- The existing per-agent prompts are preserved as the single source for their rules —
  the combined prompt is assembled FROM `_job_analysis_prompt` etc. text where practical
  so wording doesn't silently diverge.

## 4. Router integration

Single call via `stream_structured_llm` (streaming path) / `get_structured_llm`
(non-streaming), passing `task_type="resume_analysis"`. Invalid structured output ->
`SchemaValidationError` -> router fallback. Per-provider hard timeout applies to the one
call. (Note: one larger call ~ higher token count per request; Groq 8000 TPM may 413 ->
router already classifies as rate_limit and falls back. Acceptable and already handled.)

## 5. Streaming UX

`/api/analyze/stream` currently streams 4 phases (resume read + 3 agents). New flow:
- Keep lightweight progress events: `resume_analyzer` (PyPDF, instant) then a single
  `analyzer` agent that streams the combined generation's tokens, then completed.
- Preserve the same event envelope + final `pipeline_completed` with identical
  `AnalysisResponse`. Frontend `Processing.tsx` still works (it renders whatever agents
  it's given); labels adjusted to reflect one analysis step.

## 6. Backward compatibility

- `run_full_pipeline` / `run_full_pipeline_streaming` keep their signatures + return
  `AnalysisResponse` shape.
- The old `run_job_analysis` / `run_match_analysis` / `run_resume_optimization` and their
  `_*_prompt` builders are RETAINED (still used by tests and as the rule source), but the
  pipeline no longer calls all three sequentially. Keep them (no dead-code removal that
  could break other callers) but document they're no longer on the hot path.
- Resume tailoring (`/api/tailor-resume`) is UNAFFECTED — it consumes `AnalysisResponse`,
  which is unchanged.

## 7. Measurement

Instrument before/after with the existing logger: log total wall-clock of
`run_full_pipeline` old (3 calls) vs new (1 call), and provider/latency per call from the
router logs. Expected: ~3x fewer round-trips; total latency roughly one call instead of
three serial calls; large token savings (no re-sending resume_text + full JobAnalysis +
full MatchAnalysis into downstream calls).

## 8. Tests (fake-provider, no network where possible)
1. valid resume+JD -> exactly ONE router structured call, valid AnalysisResponse.
2. skill absent -> status missing / gap, no fabricated evidence.
3. partial match represented.
4. invalid structured output -> router fallback (reuse router test harness).
5. provider timeout -> fallback (router-level, already covered; add analyze-level).
6. empty/poor JD -> graceful, no invented requirements.
7. large resume -> stays within context (assert prompt size guard / truncation note).
8. AnalysisResponse shape identical to old (golden-field test).
9. N/A (no multi-job reuse in this flow) — documented.

## 9. Risks / tradeoffs (explicit)
- One prompt doing 3 jobs can reduce per-section depth; mitigated by structured prompt +
  strong grounding. This is a quality/latency tradeoff, not free.
- Larger single request is more likely to hit Groq TPM (413) than the smaller call #1;
  router fallback absorbs it.
- Streaming per-agent granularity is reduced to one analysis step.
- Non-goal: NOT merging resume tailoring/rewriting into this call (kept separate per task
  section 11).
```
