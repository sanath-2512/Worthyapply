from typing import Literal
from langchain.agents import create_agent
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pypdf import PdfReader

load_dotenv()
# multiline input 
def get_multiline_input(title):
    print("\n" + "=" * 60)
    print(title)
    print("Type END on a new line when finished.")
    print("=" * 60)

    lines = []

    while True:
        line = input()

        if line.strip() == "END":
            break

        lines.append(line)

    return "\n".join(lines)

# from pdf to text 
def extract_resume_text(pdf_path):
    reader = PdfReader(pdf_path)

    text = []

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text.append(page_text)

    return "\n".join(text)

resume_path = input("Enter the path to your resume PDF: ")
user_profile = extract_resume_text(resume_path)

if not user_profile.strip():
    raise ValueError(
        "Could not extract any text from the resume PDF."
    )

job_description = get_multiline_input("PASTE THE JOB DESCRIPTION")

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
    

agent = create_agent(
    model="groq:openai/gpt-oss-120b",
    response_format=JobAnalysis
)

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

response = agent.invoke(
    {"messages": [{"role": "user", "content": prompt}]}
)

analysis = response["structured_response"]

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
        description="Overall match score from 0 to 100"
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

match_agent = create_agent(
    model="groq:openai/gpt-oss-120b",
    response_format=MatchAnalysis
)
match_prompt = f"""
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
match_response = match_agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": match_prompt
            }
        ]
    }
)

match_analysis = match_response["structured_response"]

optimizer_agent = create_agent(
    model="groq:openai/gpt-oss-120b",
    response_format=ResumeOptimization
)

optimization_prompt = f"""
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


optimization_response = optimizer_agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": optimization_prompt
            }
        ]
    }
)

optimization = optimization_response["structured_response"]


# output 

print("\n" + "=" * 60)
print("JOB ANALYSIS")
print("=" * 60)

print(f"\nRole: {analysis.job_title}")
print(f"Company: {analysis.company}")
print(f"Experience: {analysis.experience_required}")

print("\nTechnical Skills:")
for skill in analysis.technical_skills:
    print(f"  • {skill}")

print("\nSoft Skills:")
for skill in analysis.soft_skills:
    print(f"  • {skill}")

print("\nResponsibilities:")
for responsibility in analysis.responsibilities:
    print(f"  • {responsibility}")

print("\nNice to Have:")
for skill in analysis.nice_to_have:
    print(f"  • {skill}")

print("\nKeywords:")
print("  " + ", ".join(analysis.keywords))

print("\nSummary:")
print(f"  {analysis.summary}")


# ============================================================
# MATCH ANALYSIS
# ============================================================

print("\n" + "=" * 60)
print("MATCH ANALYSIS")
print("=" * 60)

print("\nRequired Skills:")
for skill in match_analysis.required_skills:
    print(f"  • {skill}")

print("\nMatching Skills:")
for skill in match_analysis.matching_skills:
    print(f"  ✓ {skill}")

print("\nSkill Gaps:")
for skill in match_analysis.skill_gaps:
    print(f"  ✗ {skill}")

print(f"\nMatch Score: {match_analysis.match_score}/100")

print(f"\nRecommendation: {match_analysis.recommendation}")

print(f"\nReason:")
print(f"  {match_analysis.recommendation_reason}")


# ============================================================
# RESUME OPTIMIZATION
# ============================================================

print("\n" + "=" * 60)
print("RESUME OPTIMIZATION")
print("=" * 60)

print("\nOverall Assessment:")
print(f"  {optimization.overall_assessment}")

print("\nPriority Improvements:")
for improvement in optimization.priority_improvements:
    print(f"  • {improvement}")

print("\nResume Bullet Improvements:")
for improvement in optimization.resume_bullet_improvements:

    print("\n  Original:")
    print(f"    {improvement.original}")

    print("\n  Improved:")
    print(f"    {improvement.improved}")

    print("\n  Why:")
    print(f"    {improvement.reason}")

print("\nKeywords to Include:")
for keyword in optimization.keywords_to_include:
    print(f"  ✓ {keyword}")

print("\nMissing / Weak Requirements:")
for requirement in optimization.missing_or_weak_requirements:
    print(f"  ⚠ {requirement}")

print("\nWarnings:")
for warning in optimization.warnings:
    print(f"  ! {warning}")