"""
Resume Tailoring Agent for WorthyApply V3.

Sits AFTER the existing JD Analysis Agent. Its single job is to APPLY the
recommendations the analysis already produced to the user's EXISTING
structured resume, so the result drops straight into the existing Resume
Editor.

It does NOT:
- re-analyze the JD,
- compute a match score,
- parse the resume (that is done by resume_extractor),
- build a resume from scratch, render, or export.

It reuses the EXISTING structured resume schema (ExtractedResume, which
mirrors the frontend ResumeData) and the existing _cleanup() so no new
resume schema or renderer is introduced.

HARD RULE: never fabricate candidate information. The JD/analysis tells the
agent what is important; it does not grant permission to claim skills or
experience the resume does not already demonstrate.
"""

import json
import logging
from typing import Iterator, Literal

from pydantic import BaseModel, Field

# Reuse the EXISTING structured resume schema + cleanup. No new schema.
from .resume_extractor import ExtractedResume, _cleanup

logger = logging.getLogger("worthyapply.resume_tailor")

AGENT = "resume_tailor"


class ResumeChange(BaseModel):
    section: str = Field(
        description="Which resume section changed: summary, skills, experience, "
        "projects, education, certificates, or personal"
    )
    description: str = Field(
        description="Concise, human-readable description of the meaningful change made"
    )


class RecommendationResult(BaseModel):
    """Tracks whether ONE actionable analysis recommendation was applied."""
    id: int = Field(description="The checklist number of the recommendation being tracked")
    recommendation: str = Field(description="The recommendation text, copied from the checklist")
    status: Literal["implemented", "not_implemented"] = Field(
        description="'implemented' if you applied it, 'not_implemented' if you could not"
    )
    section: str = Field(
        default="",
        description="Which resume section it affects (skills, summary, experience, "
        "projects, certificates, personal). Required when status='implemented'.",
    )
    change: str = Field(
        default="",
        description="Exactly what you changed. Required when status='implemented'.",
    )
    reason: str = Field(
        default="",
        description="Why it was NOT implemented. Required when status='not_implemented'. "
        "The ONLY valid reason is that the resume contains no supporting evidence.",
    )


class BulletEdit(BaseModel):
    """Rewrite the HTML description of ONE existing entry, addressed by its index."""
    index: int = Field(
        description="0-based index of the existing entry to edit (as given in the input)"
    )
    new_description: str = Field(
        description="Rewritten HTML description for that entry as <ul><li>...</li></ul>. "
        "Sharpen and reframe bullets for JD relevance using facts already in this "
        "entry. You may split a vague bullet into more specific true bullets, but you "
        "must NOT drop any information or facts present in the original, and must not "
        "invent anything not supported by the entry."
    )


class SkillCategoryEdit(BaseModel):
    """Set the skills string for ONE existing skill category, addressed by index."""
    index: int = Field(description="0-based index of the existing skill category to edit")
    new_skills: str = Field(
        description="Comma-separated skills for that category, reordered to bring "
        "JD-relevant skills forward. You MAY surface a skill that the resume already "
        "demonstrates elsewhere (e.g. in an experience/project `technologies` field "
        "or a bullet) even if it wasn't in this category before — that is truthful, "
        "not fabrication. You may NOT add a skill that appears NOWHERE in the resume."
    )


class ResumeTailorPatch(BaseModel):
    """
    A SMALL set of targeted edits, NOT a whole new resume.

    Anything not referenced here is preserved EXACTLY from the original resume.
    All *_order fields are lists of original 0-based indices describing the new
    order; omit (empty list) to keep the original order. This makes preservation
    the default and prevents summarizing/dropping content.
    """
    new_summary: str = Field(
        default="",
        description="New professional summary. Leave EMPTY to keep the original summary.",
    )
    new_title: str = Field(
        default="",
        description="New professional title for personal.title. Leave EMPTY to keep original.",
    )
    experience_edits: list[BulletEdit] = Field(
        default_factory=list,
        description="Rewrites of specific experience descriptions. Only include entries "
        "you actually changed.",
    )
    experience_order: list[int] = Field(
        default_factory=list,
        description="New order of experience entries as original indices; empty = keep order.",
    )
    project_edits: list[BulletEdit] = Field(
        default_factory=list,
        description="Rewrites of specific project descriptions. Only changed entries.",
    )
    project_order: list[int] = Field(
        default_factory=list,
        description="New order of projects as original indices; empty = keep order.",
    )
    skill_edits: list[SkillCategoryEdit] = Field(
        default_factory=list,
        description="Reordered skill strings for specific categories. Only changed ones.",
    )
    skill_order: list[int] = Field(
        default_factory=list,
        description="New order of skill categories as original indices; empty = keep order.",
    )
    certificate_order: list[int] = Field(
        default_factory=list,
        description="New order of certificates as original indices; empty = keep order.",
    )
    changes: list[ResumeChange] = Field(
        default_factory=list,
        description="Concise list of the meaningful changes made. Only actual changes.",
    )
    recommendations: list[RecommendationResult] = Field(
        default_factory=list,
        description="MANDATORY: one entry for EVERY numbered recommendation in the "
        "checklist, reporting whether it was implemented.",
    )


# Kept for backwards compatibility / callers that referenced the old container.
class TailoredResume(BaseModel):
    resume: ExtractedResume = Field(
        description="The tailored resume, in the exact existing Resume Builder schema"
    )
    changes: list[ResumeChange] = Field(default_factory=list)


def build_recommendation_checklist(analysis: dict) -> list[str]:
    """
    Deterministically extract the actionable recommendations from the existing
    JD analysis. This is the SOURCE OF TRUTH for what the tailoring agent must
    address — coverage is decided here in code, not by the LLM's discretion.

    Pulls from analysis.resume_optimization:
      - resume_bullet_improvements (each original->improved is one recommendation)
      - priority_improvements
      - keywords_to_include (as a single "incorporate these where truthful" item)
      - missing_or_weak_requirements (each is one recommendation)
    """
    opt = (analysis or {}).get("resume_optimization", {}) or {}
    checklist: list[str] = []

    for imp in opt.get("resume_bullet_improvements", []) or []:
        if isinstance(imp, dict):
            original = (imp.get("original") or "").strip()
            improved = (imp.get("improved") or "").strip()
            if original or improved:
                checklist.append(
                    f'Rewrite the resume bullet "{original}" to: "{improved}"'
                )

    for pri in opt.get("priority_improvements", []) or []:
        if isinstance(pri, str) and pri.strip():
            checklist.append(pri.strip())

    kws = [k for k in (opt.get("keywords_to_include", []) or []) if isinstance(k, str) and k.strip()]
    if kws:
        checklist.append(
            "Incorporate these JD keywords where they truthfully describe existing "
            "experience: " + ", ".join(kws)
        )

    for miss in opt.get("missing_or_weak_requirements", []) or []:
        if isinstance(miss, str) and miss.strip():
            checklist.append(
                f"Strengthen or address this weak/missing requirement if the resume "
                f"has supporting evidence: {miss.strip()}"
            )

    # De-duplicate while preserving order.
    seen = set()
    unique = []
    for item in checklist:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def _format_checklist(checklist: list[str]) -> str:
    if not checklist:
        return "(No actionable recommendations were found in the analysis.)"
    return "\n".join(f"{i + 1}. {rec}" for i, rec in enumerate(checklist))


def _tailoring_prompt(
    resume_json: str, job_description: str, analysis_json: str, checklist_text: str
) -> str:
    return f"""
You are the WorthyApply Resume Tailoring Agent.

Your job: produce a SMALL SET OF TARGETED EDITS that better tailor the
candidate's EXISTING resume to the target job, by APPLYING the recommendations
the JD Analysis Agent has ALREADY produced.

CRITICAL — YOU ARE NOT REWRITING THE RESUME:
- You do NOT output a full resume. You output only a PATCH (specific edits).
- Everything you do NOT explicitly edit is kept EXACTLY as-is by the system.
- Therefore you must NEVER summarize, shorten, compress, trim, or drop content.
- Do NOT remove experience entries, projects, bullets, skills, or sections.

YOUR MANDATE — MAKE THE RESUME GENUINELY, VISIBLY TAILORED (WITHOUT FABRICATING):
- This is a serious rewrite for relevance, not a light touch-up. Be thorough.
- Use the analysis AND the job description together to reframe the candidate's
  EXISTING experience in the language of this role. Every bullet, project, and the
  summary that relates to the JD should end up clearly communicating that relevance.
- Do not restrict yourself to only the bullets named in the analysis. Also improve
  any vague/generic bullet that relates to the JD, making it specific using the
  technologies and context the candidate ALREADY lists for that entry.
- "When in doubt": if a bullet relates to the JD and you can make it clearer and more
  relevant using facts already in the resume, DO improve it. Only leave content
  unchanged when it is already strong and relevant, or genuinely unrelated to the JD.
- The bar for a good result: a recruiter reading the tailored resume should
  immediately see this candidate fits THIS job, using only true information.

The ONLY things you may never do: invent skills/experience that aren't in the resume,
drop content, or change facts (employers, titles, dates, degrees, grades, metrics).

Do NOT compute a match score.

EXISTING STRUCTURED RESUME (source of truth; indices are 0-based array positions):
{resume_json}

JOB DESCRIPTION (for wording/terminology context only):
{job_description}

EXISTING JD ANALYSIS (your instructions for what to improve):
{analysis_json}

=================  MANDATORY RECOMMENDATION CHECKLIST  =================
These numbered recommendations were extracted from the analysis. You MUST
process EVERY one of them. You are not allowed to decide a recommendation is
unimportant and skip it. For each, either implement it (if the resume contains
supporting evidence) or mark it not_implemented with the reason that no
supporting evidence exists — those are the ONLY two allowed outcomes.

{checklist_text}

For EACH numbered item above, in your `recommendations` output, return one entry
with the same `id`, the `recommendation` text, a `status` of "implemented" or
"not_implemented", and (if implemented) the `section` + `change`, or (if not)
the `reason`. Do NOT omit any number. Do NOT fabricate evidence to force an
"implemented" status — if the resume genuinely lacks the information, it is
"not_implemented" with reason "No supporting evidence exists in the resume".
=======================================================================

HOW TO USE THE ANALYSIS — THIS IS THE HEART OF YOUR JOB.
Your edits MUST be driven by the specific fields inside
`analysis.resume_optimization`. Do not invent your own agenda; apply what the
analysis already decided:

1. resume_optimization.resume_bullet_improvements — a list of
   {{original, improved, reason}}. For EACH item:
   - Find the resume bullet whose text matches (or closely matches) `original`.
   - Replace that bullet's text with `improved` (keep it as its own <li>).
   - Target the entry (experience or project) that contains it in experience_edits
     or project_edits, rewriting the FULL description with the improved bullet in
     place and every OTHER bullet kept (you may further improve those other bullets
     for JD relevance per the mandate — see below — but never drop them).
   - Apply every improvement whose `original` you can locate. If you cannot find a
     matching bullet, do not invent one.
   BEYOND the named bullets: for every experience/project entry that relates to the
   JD, also sharpen its remaining vague bullets — turn "Worked on X" into a specific,
   JD-aligned statement built from the technologies/context that entry already lists.
   Aim to make each relevant entry clearly communicate fit, truthfully.

2. resume_optimization.keywords_to_include — weave these terms into existing
   bullets/summary ONLY where they truthfully describe work the candidate already
   did (usually while applying an `improved` bullet above). Never add a keyword that
   the resume does not already support. No keyword stuffing.

3. resume_optimization.missing_or_weak_requirements and .priority_improvements —
   these are your highest-priority targets. For EACH weak/missing requirement:
   - First check the ENTIRE resume (bullets, technologies fields, projects,
     skills) for evidence the candidate ALREADY has it but described it vaguely
     or buried it. If such evidence exists, SURFACE it: rewrite the relevant
     bullet(s) to state that experience clearly and specifically, and make sure
     the skill appears in the skills section (it is not fabrication to list a
     skill the resume already demonstrates in a `technologies` field or bullet).
     This is the main way to legitimately raise the match — closing PRESENTATION
     gaps, where real experience was just weakly worded.
   - Only if there is genuinely NO evidence anywhere in the resume, leave it as a
     real gap. Never invent it. A truly-missing skill stays missing (the user adds
     it later if it is actually true).
   Turn vague, generic bullets ("Worked on the website", "Did some backend stuff")
   into specific, evidence-backed statements using the technologies the candidate
   actually lists for that role/project.

4. resume_optimization.overall_assessment and match_analysis — context for the
   summary rewrite. Rewrite new_summary to emphasize the candidate's most relevant
   EXISTING experience per the assessment. If the summary is already strong, and the
   analysis does not call it out, leave new_summary EMPTY.

Make deliberate, traceable edits: every change you make should correspond to a
specific analysis recommendation. Do NOT make cosmetic or random changes that the
analysis did not ask for.

WHAT YOU MAY EDIT (leave anything else untouched):

- new_summary: rewrite per point 4 above, or leave EMPTY.
- new_title: only if a better title honestly reflects the candidate. Otherwise EMPTY.
- experience_edits: for each JD-relevant experience entry, rewrite its FULL HTML
  description: apply the named improvement(s) AND sharpen the other relevant bullets
  using facts already in that entry. You may split a vague bullet into more specific
  true bullets. You must NOT drop any fact/topic from the original and must NOT invent
  anything. Keep role, company, dates untouched.
- project_edits: same, for projects.
- experience_order / project_order / skill_order / certificate_order: reorder to bring
  the most JD-relevant items forward per the analysis. Provide the FULL set of original
  indices in the new order (a permutation) — do not omit any index, or that item would
  be lost. Leave EMPTY to keep the original order.
- skill_edits: reorder skills within a category to bring analysis-relevant ones forward.
  You MAY surface into a category a skill the resume already demonstrates elsewhere
  (e.g. listed in a role/project `technologies` field or a bullet) — that is truthful.
  You may NEVER add a skill that appears nowhere in the resume.

ABSOLUTE ANTI-FABRICATION RULES (highest priority):
- NEVER add or claim skills, technologies, frameworks, tools, employers, titles,
  responsibilities, projects, certifications, education, achievements, metrics, years
  of experience, locations, or credentials the resume does not already contain.
- Example: if the JD wants Next.js but the resume only shows React, do NOT add Next.js.
- Never invent numbers/metrics. Use JD terminology only where it accurately describes
  work the candidate already did. No keyword stuffing.

OUTPUT:
- Use the patch fields above. Be thorough: edit the summary and every JD-relevant
  experience/project entry so the tailoring is clearly visible — while keeping every
  fact true and never dropping content.
- changes: a concise list of the meaningful changes you made (section + short description).
  Only list edits you actually made.
- recommendations: MANDATORY. Exactly one entry per numbered checklist item above,
  each reporting implemented (with section + change) or not_implemented (with reason).
"""


def _reorder(items: list, order: list[int]) -> list:
    """
    Reorder `items` per `order` (a list of original indices). Preservation-safe:
    if `order` is empty or not a valid permutation, the original list is returned
    unchanged, and any indices missing from `order` are appended so nothing is lost.
    """
    if not order:
        return items
    n = len(items)
    seen = set()
    valid = []
    for i in order:
        if isinstance(i, int) and 0 <= i < n and i not in seen:
            seen.add(i)
            valid.append(i)
    # Append any indices the model forgot, so no entry is ever dropped.
    for i in range(n):
        if i not in seen:
            valid.append(i)
    return [items[i] for i in valid]


def _apply_patch(resume: ExtractedResume, patch: ResumeTailorPatch) -> ExtractedResume:
    """
    Apply the targeted patch to a deep copy of the original resume.

    Anything the patch does not reference is carried over EXACTLY. This is what
    guarantees the tailored resume contains everything the original did — the
    model only supplies small edits, never a regenerated (and thus summarized)
    resume.
    """
    # Deep copy so the original object is never mutated.
    out = resume.model_copy(deep=True)

    # Summary / title (only if provided).
    if patch.new_summary.strip():
        out.summary = patch.new_summary
    if patch.new_title.strip():
        out.personal.title = patch.new_title

    # Experience: apply description rewrites by index, then reorder.
    for edit in patch.experience_edits:
        if 0 <= edit.index < len(out.experience) and edit.new_description.strip():
            out.experience[edit.index].description = edit.new_description
    out.experience = _reorder(out.experience, patch.experience_order)

    # Projects: same pattern.
    for edit in patch.project_edits:
        if 0 <= edit.index < len(out.projects) and edit.new_description.strip():
            out.projects[edit.index].description = edit.new_description
    out.projects = _reorder(out.projects, patch.project_order)

    # Skills: reorder skill strings within a category, then reorder categories.
    for edit in patch.skill_edits:
        if 0 <= edit.index < len(out.skills) and edit.new_skills.strip():
            out.skills[edit.index].skills = edit.new_skills
    out.skills = _reorder(out.skills, patch.skill_order)

    # Certificates: reorder only.
    out.certificates = _reorder(out.certificates, patch.certificate_order)

    # Education, activities, personal contact/links: untouched by design.
    return out


def _reconcile_recommendations(
    checklist: list[str], reported: list[RecommendationResult]
) -> list[dict]:
    """
    Validation step: guarantee EVERY checklist item has a tracking entry, keyed by
    its checklist number. If the model omitted an item, we surface it explicitly as
    'unknown' rather than letting it silently disappear — coverage is enforced in
    code, not left to the model.
    """
    by_id: dict[int, RecommendationResult] = {}
    for r in reported:
        # Model ids are 1-based checklist numbers; keep the first valid one per id.
        if isinstance(r.id, int) and 1 <= r.id <= len(checklist) and r.id not in by_id:
            by_id[r.id] = r

    results: list[dict] = []
    for i, rec_text in enumerate(checklist, start=1):
        r = by_id.get(i)
        if r is None:
            # Model failed to report this item — never drop it.
            results.append({
                "id": i,
                "recommendation": rec_text,
                "status": "not_implemented",
                "section": "",
                "change": "",
                "reason": "Not addressed by the tailoring step.",
            })
        else:
            results.append({
                "id": i,
                # Prefer the canonical checklist text (source of truth) over the model echo.
                "recommendation": rec_text,
                "status": r.status,
                "section": r.section,
                "change": r.change,
                "reason": r.reason,
            })
    return results


def tailor_resume_streaming(
    resume: ExtractedResume,
    job_description: str,
    analysis: dict,
) -> Iterator[dict]:
    """
    Streaming generator that applies the JD-analysis recommendations to the
    existing structured resume.

    Yields event dicts consistent with the rest of the pipeline:
        agent_started, agent_progress, agent_token, agent_output,
        agent_completed, agent_error, pipeline_completed

    The final `pipeline_completed.result` has shape:
        {"resume": <ExtractedResume dict>, "changes": [<ResumeChange dict>...]}
    which is directly consumable by the existing Resume Editor (the `resume`
    matches the builder schema).
    """
    from .llm import stream_structured_llm

    yield {"type": "agent_started", "agent": AGENT}

    # 1) Deterministically build the recommendation checklist from the analysis.
    checklist = build_recommendation_checklist(analysis)
    yield {
        "type": "agent_progress",
        "agent": AGENT,
        "message": (
            f"Applying {len(checklist)} recommendation(s) from the analysis..."
            if checklist
            else "Tailoring your resume to this job..."
        ),
    }

    resume_json = json.dumps(resume.model_dump())
    analysis_json = json.dumps(analysis)
    prompt = _tailoring_prompt(
        resume_json, job_description, analysis_json, _format_checklist(checklist)
    )

    try:
        patch: ResumeTailorPatch | None = None
        for item in stream_structured_llm(prompt, ResumeTailorPatch):
            if item["type"] == "token":
                yield {"type": "agent_token", "agent": AGENT, "text": item["text"]}
            elif item["type"] == "result":
                patch = item["value"]
        if patch is None:
            raise ValueError("no result produced")

        # 2) Apply the patch to a COPY of the original. Everything not referenced by
        #    the patch is preserved exactly — nothing is summarized or dropped.
        tailored = _apply_patch(resume, patch)
        tailored = _cleanup(tailored)

        # 3) Validation: enforce that every checklist item is accounted for.
        recommendations = _reconcile_recommendations(checklist, patch.recommendations)
    except Exception:
        logger.exception("resume tailoring failed")
        yield {
            "type": "agent_error",
            "agent": AGENT,
            "message": "Could not tailor your resume. Please try again.",
        }
        return

    implemented = sum(1 for r in recommendations if r["status"] == "implemented")
    logger.info(
        "tailoring applied %d/%d recommendations", implemented, len(recommendations)
    )

    payload = {
        "resume": tailored.model_dump(),
        "changes": [c.model_dump() for c in patch.changes],
        "recommendations": recommendations,
    }
    yield {"type": "agent_output", "agent": AGENT, "data": payload}
    yield {"type": "agent_completed", "agent": AGENT}
    yield {"type": "pipeline_completed", "result": payload}
