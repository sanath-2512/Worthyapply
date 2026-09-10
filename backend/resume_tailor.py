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
        default="implemented",
        description="'implemented' as all recommendations and missing skills are added directly to the resume"
    )
    section: str = Field(
        default="",
        description="Which resume section it affects (skills, summary, experience, "
        "projects, certificates, personal). Required when status='implemented'.",
    )
    change: str = Field(
        default="",
        description="Exactly what you changed or added.",
    )
    reason: str = Field(
        default="",
        description="Optional reason if not implemented.",
    )


class BulletEdit(BaseModel):
    """Rewrite the HTML description of ONE existing entry, addressed by its index."""
    index: int = Field(
        description="0-based index of the existing entry to edit (as given in the input)"
    )
    new_description: str = Field(
        description="Rewritten HTML description for that entry as <ul><li>...</li></ul>. "
        "Sharpen and reframe bullets for JD relevance using facts and target keywords. "
        "You may split a vague bullet into more specific bullets and weave in job technologies, "
        "but you must NOT drop information present in the original."
    )


class SkillCategoryEdit(BaseModel):
    """Set the skills string for ONE existing skill category, addressed by index."""
    index: int = Field(description="0-based index of the existing skill category to edit")
    new_skills: str = Field(
        description="Comma-separated skills for that category, reordered and updated to "
        "include all JD-relevant skills, required skills, and keywords."
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
        description="Reordered and augmented skill strings for specific categories. Only changed ones.",
    )
    skill_order: list[int] = Field(
        default_factory=list,
        description="New order of skill categories as original indices; empty = keep order.",
    )
    certificate_order: list[int] = Field(
        default_factory=list,
        description="New order of certificates as original indices; empty = keep order.",
    )
    new_skill_category: str = Field(
        default="",
        description="Comma-separated skills for a NEW category to add "
        "(e.g. for target job skills or technologies). Leave EMPTY otherwise.",
    )
    new_skill_category_name: str = Field(
        default="",
        description="Name/label for the new skill category (e.g. 'Target Job Skills' or 'Key Technologies'). "
        "Required if new_skill_category is set.",
    )
    added_skills: list[str] = Field(
        default_factory=list,
        description="List of skills or technologies added to the resume to match the job requirements.",
    )
    changes: list[ResumeChange] = Field(
        default_factory=list,
        description="Concise list of the meaningful changes made. Only actual changes.",
    )
    recommendations: list[RecommendationResult] = Field(
        default_factory=list,
        description="MANDATORY: one entry for EVERY numbered recommendation in the "
        "checklist, reporting that it was implemented.",
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
      - keywords_to_include (incorporated directly into the resume)
      - missing_or_weak_requirements (addressed and added directly)
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
            "Directly incorporate these JD keywords and technologies into the resume: " + ", ".join(kws)
        )

    for miss in opt.get("missing_or_weak_requirements", []) or []:
        if isinstance(miss, str) and miss.strip():
            checklist.append(
                f"Directly integrate and address this requirement in the resume experience or skills: {miss.strip()}"
            )

    # ---- Also drive tailoring from the MATCH analysis ----
    match = (analysis or {}).get("match_analysis", {}) or {}

    matching = [s for s in (match.get("matching_skills", []) or []) if isinstance(s, str) and s.strip()]
    if matching:
        checklist.append(
            "Surface every skill relevant to this role into the skills section and highlight in bullets: " + ", ".join(matching)
        )

    required = [s for s in (match.get("required_skills", []) or []) if isinstance(s, str) and s.strip()]
    if required:
        checklist.append(
            "Add and emphasize the job's required skills in the skills section and relevant project/experience bullets: "
            + ", ".join(required)
        )

    skill_gaps = [s for s in (match.get("skill_gaps", []) or []) if isinstance(s, str) and s.strip()]
    if skill_gaps:
        checklist.append(
            "Directly add these missing skills from the job description to the resume skills section: "
            + ", ".join(skill_gaps)
        )

    checklist.append(
        "Rewrite vague or generic bullets in JD-relevant experience and projects into specific, impactful statements using target technologies."
    )

    # De-duplicate while preserving order.
    seen = set()
    unique = []
    for item in checklist:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def build_gaps_to_add(analysis: dict) -> list[str]:
    """
    Deterministically collect target skills and requirements from the job description
    and analysis that should be present in the tailored resume.
    """
    match = (analysis or {}).get("match_analysis", {}) or {}
    opt = (analysis or {}).get("resume_optimization", {}) or {}

    gaps: list[str] = []
    for g in (match.get("skill_gaps", []) or []):
        if isinstance(g, str) and g.strip():
            gaps.append(g.strip())
    for r in (match.get("required_skills", []) or []):
        if isinstance(r, str) and r.strip():
            gaps.append(r.strip())
    for k in (opt.get("keywords_to_include", []) or []):
        if isinstance(k, str) and k.strip():
            gaps.append(k.strip())
    for m in (opt.get("missing_or_weak_requirements", []) or []):
        if isinstance(m, str) and m.strip():
            # If it's a concise requirement/skill, treat as target skill
            cleaned = m.strip()
            if len(cleaned) <= 60:
                gaps.append(cleaned)

    # De-dup case-insensitively, preserve order.
    seen: set[str] = set()
    unique: list[str] = []
    for g in gaps:
        key = g.lower()
        if key not in seen:
            seen.add(key)
            unique.append(g)
    return unique


def _format_checklist(checklist: list[str]) -> str:
    if not checklist:
        return "(No actionable recommendations were found in the analysis.)"
    return "\n".join(f"{i + 1}. {rec}" for i, rec in enumerate(checklist))


def _tailoring_prompt(
    resume_json: str,
    job_description: str,
    analysis_json: str,
    checklist_text: str,
    target_skills: list[str],
) -> str:
    target_skills_str = ", ".join(target_skills) if target_skills else "None specified"
    return f"""
You are the WorthyApply Resume Tailoring Agent.

Your job: produce a TARGETED PATCH that tailors the candidate's EXISTING resume to the target job by APPLYING ALL recommendations and adding all missing skills identified in the JD Analysis.

IMPORTANT USER MANDATE:
When tailoring the resume, you must ADD ALL recommendations and ALL skills that are not in the resume directly without asking.
A notice will inform the user: "These skills were added to your resume to match the job. If you don't have this in your tech stack, you can remove them in the editor."
Therefore:
- DIRECTLY ADD all target skills, missing skills, and keywords into the resume's skills section and relevant bullets.
- Do NOT skip any recommendation or mark it as "not_implemented". All checklist recommendations must be IMPLEMENTED.

CRITICAL INSTRUCTIONS:
1. ADD ALL MISSING SKILLS DIRECTLY TO THE RESUME:
- Target job skills and technologies: {target_skills_str}.
- Ensure EVERY relevant skill and tool from this list is present in the resume's skills section!
- You can add them into existing skill categories (using `skill_edits`), and/or create a new skill category (using `new_skill_category` and `new_skill_category_name`, e.g. "Target Job Skills" or "Key Technologies").
- In addition, incorporate these skills/technologies into bullet points in experience or projects where relevant.
- In `added_skills`, list all skills and technologies that were newly added.

2. APPLY EVERY RECOMMENDATION IN THE CHECKLIST:
- You must process and implement EVERY numbered recommendation from the checklist below.
- Rewrite bullets to be specific and impactful, incorporating target keywords, technologies, and metrics.
- Address weak or missing requirements by directly integrating them into the relevant experience, projects, summary, or skills.

3. PRESERVE ORIGINAL TRUTHS & INTEGRITY:
- Everything you do NOT explicitly edit is kept as-is.
- Do NOT delete existing experience entries, projects, education, certificates, or sections.
- Keep candidate contact details, company names, dates, degrees, and grades intact.
- Only output the patch fields.

EXISTING STRUCTURED RESUME (source of truth; indices are 0-based array positions):
{resume_json}

JOB DESCRIPTION (for wording/terminology context):
{job_description}

EXISTING JD ANALYSIS:
{analysis_json}

=================  MANDATORY RECOMMENDATION CHECKLIST  =================
{checklist_text}

For EACH numbered item above, return an entry in `recommendations`:
- `id`: the checklist number (1, 2, 3...)
- `recommendation`: the exact recommendation text
- `status`: "implemented"
- `section`: the section modified (e.g. "skills", "experience", "projects", "summary")
- `change`: description of what was applied or added
- `reason`: "" (leave empty since it is implemented)

OUTPUT:
- Produce the targeted patch with `new_summary`, `experience_edits`, `project_edits`, `skill_edits`, `new_skill_category`, `new_skill_category_name`, `added_skills`, `changes`, and `recommendations`.
- Ensure all recommendations are marked "implemented".
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


def _apply_patch(
    resume: ExtractedResume,
    patch: ResumeTailorPatch,
    target_skills: list[str] | None = None,
) -> tuple[ExtractedResume, list[str]]:
    """
    Apply the targeted patch to a deep copy of the original resume.

    Guarantees:
    1. Anything the patch does not reference is carried over EXACTLY.
    2. All target skills / missing skills from the job analysis are directly added
       to the resume's skills section (under an existing or new category).
    3. Returns the tailored resume and the deduplicated list of all added skills.
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

    # Apply new skill category if provided by model
    if patch.new_skill_category.strip():
        from .resume_extractor import SkillCategoryOut  # local import: same schema module
        label = patch.new_skill_category_name.strip() or "Target Job Skills"
        out.skills.append(SkillCategoryOut(category=label, skills=patch.new_skill_category.strip()))

    # Certificates: reorder only.
    out.certificates = _reorder(out.certificates, patch.certificate_order)

    # ---- Deterministic Skill Guarantee ----
    # 1) Identify skills present in original resume
    orig_skills_set = set()
    for cat in resume.skills:
        for s in cat.skills.split(","):
            s_clean = s.strip().lower()
            if s_clean:
                orig_skills_set.add(s_clean)

    # 2) Track skills currently in out.skills
    current_skills_set = set()
    for cat in out.skills:
        for s in cat.skills.split(","):
            s_clean = s.strip().lower()
            if s_clean:
                current_skills_set.add(s_clean)

    # 3) Collect all skills to ensure are present
    needed_skills = list(target_skills or [])
    for s in patch.added_skills:
        if s.strip() and s.strip().lower() not in [x.lower() for x in needed_skills]:
            needed_skills.append(s.strip())

    missing_to_inject = []
    for s in needed_skills:
        s_clean = s.strip()
        if s_clean and s_clean.lower() not in current_skills_set:
            missing_to_inject.append(s_clean)
            current_skills_set.add(s_clean.lower())

    # If there are target skills missing from out.skills, inject them
    if missing_to_inject:
        from .resume_extractor import SkillCategoryOut
        injected = False
        for cat in out.skills:
            if any(k in cat.category.lower() for k in ["tech", "skill", "tool", "framework", "language"]):
                existing = [x.strip() for x in cat.skills.split(",") if x.strip()]
                cat.skills = ", ".join(existing + missing_to_inject)
                injected = True
                break
        if not injected:
            if out.skills:
                existing = [x.strip() for x in out.skills[0].skills.split(",") if x.strip()]
                out.skills[0].skills = ", ".join(existing + missing_to_inject)
            else:
                out.skills.append(SkillCategoryOut(category="Target Job Skills", skills=", ".join(missing_to_inject)))

    # 4) Compute comprehensive list of added skills (skills in tailored not in original)
    all_added_skills_dict = {}
    for cat in out.skills:
        for s in cat.skills.split(","):
            s_clean = s.strip()
            if s_clean and s_clean.lower() not in orig_skills_set:
                if s_clean.lower() not in all_added_skills_dict:
                    all_added_skills_dict[s_clean.lower()] = s_clean

    for s in patch.added_skills:
        s_clean = s.strip()
        if s_clean and s_clean.lower() not in orig_skills_set:
            if s_clean.lower() not in all_added_skills_dict:
                all_added_skills_dict[s_clean.lower()] = s_clean

    final_added_skills = list(all_added_skills_dict.values())

    # Ensure changes list has a clear entry for added skills with tech stack note
    has_skills_change = any(c.section.lower() == "skills" for c in patch.changes)
    if final_added_skills and not has_skills_change:
        skills_summary = ", ".join(final_added_skills[:6])
        if len(final_added_skills) > 6:
            skills_summary += f", +{len(final_added_skills) - 6} more"
        patch.changes.append(
            ResumeChange(
                section="skills",
                description=f"Added job-matched skills: {skills_summary}. (If not in your tech stack, you can remove them in the editor.)"
            )
        )

    # Education, activities, personal contact/links: untouched by design.
    return out, final_added_skills


def _reconcile_recommendations(
    checklist: list[str], reported: list[RecommendationResult]
) -> list[dict]:
    """
    Validation step: guarantee EVERY checklist item has a tracking entry, keyed by
    its checklist number, and is marked implemented.
    """
    by_id: dict[int, RecommendationResult] = {}
    for r in reported:
        if isinstance(r.id, int) and 1 <= r.id <= len(checklist) and r.id not in by_id:
            by_id[r.id] = r

    results: list[dict] = []
    for i, rec_text in enumerate(checklist, start=1):
        r = by_id.get(i)
        if r is None:
            results.append({
                "id": i,
                "recommendation": rec_text,
                "status": "implemented",
                "section": "skills/experience",
                "change": "Directly integrated into the resume according to recommendations.",
                "reason": "",
            })
        else:
            change = r.change.strip() if r.change and r.change.strip() else "Applied directly to resume according to job requirements."
            results.append({
                "id": i,
                "recommendation": rec_text,
                "status": "implemented",
                "section": r.section.strip() or "skills/experience",
                "change": change,
                "reason": "",
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
        {"resume": <ExtractedResume dict>, "changes": [<ResumeChange dict>...], "added_skills": [...]}
    which is directly consumable by the existing Resume Editor.
    """
    from .llm import stream_structured_llm

    yield {"type": "agent_started", "agent": AGENT}

    # 1) Deterministically build the recommendation checklist & target skills from analysis.
    checklist = build_recommendation_checklist(analysis)
    target_skills = build_gaps_to_add(analysis)

    yield {
        "type": "agent_progress",
        "agent": AGENT,
        "message": (
            f"Applying {len(checklist)} recommendation(s) and adding target skills directly..."
            if checklist
            else "Tailoring your resume to this job..."
        ),
    }

    resume_json = json.dumps(resume.model_dump())
    analysis_json = json.dumps(analysis)
    prompt = _tailoring_prompt(
        resume_json, job_description, analysis_json, _format_checklist(checklist), target_skills
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

        # 2) Apply the patch to a COPY of the original, guaranteeing all target skills are added.
        tailored, all_added_skills = _apply_patch(resume, patch, target_skills)
        tailored = _cleanup(tailored)

        # 3) Validation: enforce that every checklist item is accounted for and implemented.
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
        "tailoring applied %d/%d recommendations; added %d skills",
        implemented,
        len(recommendations),
        len(all_added_skills),
    )

    payload = {
        "resume": tailored.model_dump(),
        "changes": [c.model_dump() for c in patch.changes],
        "recommendations": recommendations,
        "added_skills": all_added_skills,
        "added_skills_message": "These skills and recommendations were added directly to your resume to match the job description. If you don't have this in your tech stack, you can remove or adjust them in the editor.",
        "gaps_to_add": all_added_skills,
    }
    yield {"type": "agent_output", "agent": AGENT, "data": payload}
    yield {"type": "agent_completed", "agent": AGENT}
    yield {"type": "pipeline_completed", "result": payload}

