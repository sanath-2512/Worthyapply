"""
Integration layer for the AI Job Application Copilot.

This module provides a web-callable interface to the same three-agent
pipeline defined in main.py. It uses the exact same:
- Pydantic schemas (JobAnalysis, MatchAnalysis, BulletImprovement, ResumeOptimization)
- Groq model (groq:openai/gpt-oss-120b)
- Agent prompts
- PDF extraction logic

main.py remains the source of truth and is NOT modified.
This wrapper exists solely to make the pipeline callable from FastAPI
without the CLI input() calls.
"""

import sys
import os
import ast
import types
import io

# Ensure the project root is importable
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

from typing import Literal
from langchain.agents import create_agent
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from pypdf import PdfReader


def _run_agent(prompt: str, response_format):
    """
    Run a structured agent with Groq as primary and Gemini as fallback.
    If Groq errors (e.g. rate limit), automatically retry with Gemini.
    """
    # Primary: Groq
    try:
        agent = create_agent(model="groq:openai/gpt-oss-120b", response_format=response_format)
        response = agent.invoke({"messages": [{"role": "user", "content": prompt}]})
        return response["structured_response"]
    except Exception as groq_error:
        result = _run_agent_gemini(prompt, response_format)
        if result is not None:
            return result
        raise groq_error


def _run_agent_gemini(prompt: str, response_format):
    """Fallback: Google Gemini, if GEMINI_API_KEY / GOOGLE_API_KEY is set."""
    import os
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0,
            google_api_key=api_key,
        )
        agent = create_agent(model=llm, response_format=response_format)
        response = agent.invoke({"messages": [{"role": "user", "content": prompt}]})
        return response["structured_response"]
    except Exception:
        import traceback
        traceback.print_exc()
        return None


# ============================================================
# Pydantic Schemas — identical to main.py
# ============================================================

class JobAnalysis(BaseModel):
    job_title: str = Field(description="The title of the job")
    company: str = Field(description="The company name, or 'Not mentioned'")
    experience_required: str = Field(
        description="Required experience, or 'Not mentioned'"
    )
    technical_skills: list[str] = Field(
        description="Technical skills explicitly required"
    )
    soft_skills: list[str] = Field(
        description="Soft skills explicitly required"
    )
    responsibilities: list[str] = Field(
        description="Main responsibilities of the role"
    )
    nice_to_have: list[str] = Field(
        description="Nice-to-have or preferred skills"
    )
    keywords: list[str] = Field(
        description="Important keywords from the job description"
    )
    summary: str = Field(
        description="Short summary of what the company is looking for"
    )


class MatchAnalysis(BaseModel):
    required_skills: list[str] = Field(
        description="Core skills required for the job"
    )
    matching_skills: list[str] = Field(
        description="Required skills explicitly demonstrated in the resume"
    )
    skill_gaps: list[str] = Field(
        description="Required skills not demonstrated in the resume"
    )
    match_score: int = Field(
        ge=0,
        le=100,
        description="Overall match score from 0 to 100",
    )
    recommendation: Literal["Apply", "Maybe", "Do Not Apply"] = Field(
        description="Whether the candidate should apply"
    )
    recommendation_reason: str = Field(
        description="Reason for the recommendation"
    )


class BulletImprovement(BaseModel):
    original: str = Field(
        description="The existing resume bullet or statement being improved"
    )
    improved: str = Field(
        description="Improved version of the existing resume content"
    )
    reason: str = Field(
        description="Why this improvement better aligns the resume with the target job"
    )


class ResumeOptimization(BaseModel):
    overall_assessment: str = Field(
        description="Overall assessment of how well the resume is positioned for the job"
    )
    priority_improvements: list[str] = Field(
        description="Most important improvements needed in the resume"
    )
    resume_bullet_improvements: list[BulletImprovement] = Field(
        description="Specific existing resume bullets that can be improved"
    )
    keywords_to_include: list[str] = Field(
        description="Relevant job keywords that can naturally be included"
    )
    missing_or_weak_requirements: list[str] = Field(
        description="Job requirements that are missing or weakly demonstrated in the resume"
    )
    warnings: list[str] = Field(
        description="Things the user should not add unless they genuinely have the experience"
    )


# ============================================================
# Response container
# ============================================================

class AnalysisResponse(BaseModel):
    job_analysis: JobAnalysis
    match_analysis: MatchAnalysis
    resume_optimization: ResumeOptimization


# ============================================================
# PDF extraction — same logic as main.py extract_resume_text
# ============================================================

def extract_resume_text_from_bytes(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using the same logic as main.py."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text.append(page_text)
    return "\n".join(text)


# ============================================================
# Model — same as main.py
# ============================================================

MODEL = "groq:openai/gpt-oss-120b"


# ============================================================
# Agent 1 — Job Analysis (same prompt as main.py)
# ============================================================

def run_job_analysis(job_description: str) -> JobAnalysis:
    prompt = f"""
You are an AI Job Description Analysis specialist.

Your ONLY task is to analyze and structure the job description.

Do NOT evaluate the candidate.
Do NOT compare the job against the resume.
Do NOT calculate a match score.
Do NOT identify matching skills.
Do NOT identify candidate skill gaps.
Do NOT make an application recommendation.

JOB DESCRIPTION:
{job_description}

Analyze the job description and return:

1. Job title
2. Company
3. Experience required
4. Technical skills
5. Soft skills
6. Responsibilities
7. Nice-to-have skills
8. Important keywords
9. Summary

IMPORTANT:
- Extract information only from the job description.
- Do not invent missing information.
- If the company or experience is not mentioned, use "Not mentioned".
- Only include skills explicitly required or clearly described.
- The summary must describe only the job and what the employer is looking for.
- Never mention the candidate, resume, candidate name, match score,
  matching skills, skill gaps, or recommendation.
"""

    return _run_agent(prompt, JobAnalysis)


# ============================================================
# Agent 2 — Match Analysis (same prompt as main.py)
# ============================================================

def run_match_analysis(analysis: JobAnalysis, user_profile: str) -> MatchAnalysis:
    prompt = f"""
You are a job candidate matching specialist.

Your ONLY task is to evaluate how well the user's resume
matches the analyzed job.

JOB ANALYSIS:
{analysis}

USER RESUME:
{user_profile}

Evaluate the candidate based on evidence in the resume.

Rules:

- Only identify a matching skill when the resume clearly
  demonstrates that skill or relevant experience.
- Do not assume the candidate knows something that is not
  demonstrated in the resume.
- Distinguish required skills from nice-to-have skills.
- Consider projects, experience, education, and demonstrated
  technical work.
- Identify genuine skill gaps.
- Give a realistic match score from 0 to 100.
- Do not invent candidate experience.
- Explain the recommendation using evidence from the resume.

Return:
1. Required skills
2. Matching skills
3. Skill gaps
4. Match score
5. Recommendation
6. Recommendation reason
"""

    return _run_agent(prompt, MatchAnalysis)


# ============================================================
# Agent 3 — Resume Optimization (same prompt as main.py)
# ============================================================

def run_resume_optimization(
    analysis: JobAnalysis,
    match_analysis: MatchAnalysis,
    user_profile: str,
) -> ResumeOptimization:
    prompt = f"""
You are an expert resume optimization assistant.

Your task is to identify specific, truthful improvements
that would make the candidate's resume better aligned
with the target job.

JOB ANALYSIS:
{analysis}

MATCH ANALYSIS:
{match_analysis}

USER RESUME:
{user_profile}

Rules:

- Only use information actually present in the resume.
- Never invent experience, skills, projects, achievements,
  technologies, responsibilities, or metrics.
- Never tell the candidate to claim experience they do not have.
- You may improve the wording of existing experience.
- You may suggest emphasizing experience that already exists.
- You may suggest keywords only when they accurately describe
  existing experience.
- Use the Match Analysis to identify the most important gaps.
- Focus on high-impact improvements.
- Keep every recommendation truthful.

Analyze:

1. Overall resume positioning
2. Highest-priority improvements
3. Specific resume bullet improvements
4. Keywords that can truthfully be emphasized
5. Missing or weak requirements
6. Things the candidate should NOT claim

- Never create placeholder metrics such as "X%", "20%", or "improved by 30%".
- If a measurable achievement is not present in the resume, rewrite
  the bullet without a metric.
- Never invent implementation details that are not supported by
  the resume.
  - Do not recommend learning, gaining, or acquiring a new skill
  as part of resume optimization.
- If a job requirement is not demonstrated in the resume, identify
  it as a gap and explicitly state that it should not be added.
  - Do not change "proposed", "analyzed", "contributed", "assisted",
  or similar levels of responsibility into stronger claims such as
  "implemented", "led", "designed", or "delivered" unless the
  resume explicitly supports that level of responsibility.
- Do not claim an outcome such as improved performance, reduced
  latency, increased reliability, or increased efficiency unless
  that outcome is explicitly supported by the resume.
"""

    return _run_agent(prompt, ResumeOptimization)


# ============================================================
# Full pipeline — runs all three agents in sequence
# ============================================================

def run_full_pipeline(
    resume_pdf_bytes: bytes, job_description: str
) -> AnalysisResponse:
    """
    Run the complete three-agent pipeline.
    Same behavior as running main.py end-to-end.
    """
    # Extract resume text (same as main.py extract_resume_text)
    resume_text = extract_resume_text_from_bytes(resume_pdf_bytes)

    if not resume_text.strip():
        raise ValueError("Could not extract any text from the resume PDF.")

    # Agent 1: Job Analysis
    job_analysis = run_job_analysis(job_description)

    # Agent 2: Match Analysis
    match_result = run_match_analysis(job_analysis, resume_text)

    # Agent 3: Resume Optimization
    optimization = run_resume_optimization(job_analysis, match_result, resume_text)

    return AnalysisResponse(
        job_analysis=job_analysis,
        match_analysis=match_result,
        resume_optimization=optimization,
    )
