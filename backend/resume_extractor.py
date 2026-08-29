"""
Resume Extraction Agent for WorthyApply V2.

Takes an uploaded resume (PDF bytes), extracts the text using the same
PyPDF logic used elsewhere, then uses a dedicated Groq agent to convert
the resume into structured data matching the WorthyApply Resume Builder
schema.

This does NOT modify the existing three-agent pipeline. It is a separate,
additive feature for the resume-builder import flow.

Rules the agent follows:
- Read the entire resume
- Extract all relevant info, mapped to the builder schema
- Keep repeated entries separate
- Preserve bullet points and links
- Never invent information; leave missing fields empty
"""

import io
from typing import Optional
from langchain.agents import create_agent
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from pypdf import PdfReader

MODEL = "groq:openai/gpt-oss-120b"


# ── Structured output matching the frontend ResumeData model ──

class PersonalInfoOut(BaseModel):
    fullName: str = Field(default="", description="Full name")
    title: str = Field(default="", description="Professional title/headline")
    phone: str = Field(default="", description="Phone number")
    email: str = Field(default="", description="Email address")
    linkedin: str = Field(default="", description="LinkedIn URL")
    github: str = Field(default="", description="GitHub URL")
    codechef: str = Field(default="", description="CodeChef URL")
    codeforces: str = Field(default="", description="Codeforces URL")
    leetcode: str = Field(default="", description="LeetCode URL")
    portfolio: str = Field(default="", description="Portfolio/personal website URL")


class EducationOut(BaseModel):
    institution: str = Field(default="")
    degree: str = Field(default="")
    location: str = Field(default="")
    startDate: str = Field(default="")
    endDate: str = Field(default="")
    grade: str = Field(default="", description="Grade or GPA, e.g. '8.28/10' — empty if not present")
    info: str = Field(default="")


class ExperienceOut(BaseModel):
    role: str = Field(default="")
    company: str = Field(default="")
    location: str = Field(default="")
    startDate: str = Field(default="")
    endDate: str = Field(default="", description="Empty if currently working")
    currentlyWorking: bool = Field(default=False)
    description: str = Field(
        default="",
        description="HTML with bullet points as <ul><li>...</li></ul>. Preserve each bullet separately.",
    )
    technologies: str = Field(default="", description="Comma-separated technologies if listed")


class ProjectOut(BaseModel):
    name: str = Field(default="")
    category: str = Field(default="", description="Only if explicitly stated; otherwise empty")
    github: str = Field(default="", description="Code/GitHub URL")
    demo: str = Field(default="", description="Hosted/Demo URL")
    date: str = Field(default="")
    currentlyWorking: bool = Field(default=False)
    description: str = Field(
        default="",
        description="HTML with bullet points as <ul><li>...</li></ul>. Preserve each bullet separately.",
    )
    technologies: str = Field(default="")


class CertificateOut(BaseModel):
    title: str = Field(default="")
    organisation: str = Field(default="")
    issueDate: str = Field(default="")
    expiryDate: str = Field(default="")
    link: str = Field(default="")
    description: str = Field(default="", description="HTML if formatted")


class SkillCategoryOut(BaseModel):
    category: str = Field(default="", description="e.g. 'Languages', 'Frameworks'")
    skills: str = Field(default="", description="Comma-separated skills")


class ActivityOut(BaseModel):
    title: str = Field(default="")
    organizations: str = Field(default="")
    description: str = Field(default="", description="HTML if formatted")


class ExtractedResume(BaseModel):
    personal: PersonalInfoOut = Field(default_factory=PersonalInfoOut)
    summary: str = Field(default="", description="Professional summary; HTML if formatted")
    education: list[EducationOut] = Field(default_factory=list)
    experience: list[ExperienceOut] = Field(default_factory=list)
    projects: list[ProjectOut] = Field(default_factory=list)
    certificates: list[CertificateOut] = Field(default_factory=list)
    skills: list[SkillCategoryOut] = Field(default_factory=list)
    activities: list[ActivityOut] = Field(default_factory=list)


def _extract_hyperlinks(reader: PdfReader) -> list[str]:
    """
    Pull hyperlink URLs from PDF link annotations.
    PyPDF's extract_text() only returns visible text (e.g. "GitHub"),
    not the underlying URL. Links live in page annotations.
    """
    urls: list[str] = []
    for page in reader.pages:
        annots = page.get("/Annots")
        if not annots:
            continue
        try:
            annots = annots.get_object()
        except Exception:
            continue
        for annot in annots:
            try:
                obj = annot.get_object()
                action = obj.get("/A")
                if action:
                    action = action.get_object()
                    uri = action.get("/URI")
                    if uri:
                        uri = str(uri)
                        if uri not in urls:
                            urls.append(uri)
            except Exception:
                continue
    return urls


def extract_resume_text_from_bytes(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text.append(page_text)

    combined = "\n".join(text)

    # Append any hyperlink URLs found in the PDF annotations so the agent
    # can map them to the correct fields (visible label -> actual URL).
    links = _extract_hyperlinks(reader)
    if links:
        combined += "\n\nHYPERLINKS FOUND IN DOCUMENT:\n" + "\n".join(links)

    return combined


EXTRACTION_PROMPT = """
You are a resume information extraction agent for WorthyApply.

TASK:
Convert the resume text below into structured data matching the
WorthyApply Resume Builder schema.

RULES:
1. Read the ENTIRE resume.
2. Extract ALL relevant information into the correct fields.
3. Keep repeated entries (education, experience, projects, certificates) SEPARATE.
4. Preserve bullet points. For descriptions, output HTML using
   <ul><li>bullet one</li><li>bullet two</li></ul>. Each original
   bullet must be its own <li>. Do NOT merge bullets into one paragraph.
5. Extract actual hyperlink URLs. A section titled "HYPERLINKS FOUND IN
   DOCUMENT" may be appended at the end — these are the real URLs behind
   visible labels like "LinkedIn" or "GitHub". Match each URL to the
   correct field by inspecting the URL domain:
   - linkedin.com  -> personal.linkedin
   - github.com    -> personal.github (unless it's clearly a project repo)
   - codechef.com  -> personal.codechef
   - codeforces.com-> personal.codeforces
   - leetcode.com  -> personal.leetcode
   - a personal domain / portfolio site -> personal.portfolio
   For project links: a github.com URL near a project -> project.github,
   a hosted/demo URL (vercel, netlify, etc.) -> project.demo.
   Always store the full URL, never just the label.
6. Parse dates as written (e.g. "June 2026", "2024"). Do NOT fabricate months.
7. If a role says "Present" or "Current", set currentlyWorking = true and
   leave endDate empty.
8. NEVER invent information. Do not add skills, technologies, companies,
   projects, dates, grades, or certificates that are not in the resume.
9. If a field is not present, leave it EMPTY. Wrong data is worse than empty.
10. Preserve skill categories if the resume groups them; otherwise put all
    skills in one category called "Skills".
11. Map extracurriculars, achievements, hackathons, competitions, sports,
    and positions of responsibility to activities.
12. Do NOT rewrite or optimize wording — extract accurately.
13. COMPLETENESS IS CRITICAL: extract EVERY section including the ones at
    the very END of the resume (e.g. Extra-Curricular Activities,
    Achievements). Do not stop early. Every activity, hackathon, sport,
    and competitive-programming entry near the bottom must be captured as
    a separate activity item.

RESUME TEXT:
{resume_text}
"""


def extract_resume(pdf_bytes: bytes) -> ExtractedResume:
    resume_text = extract_resume_text_from_bytes(pdf_bytes)
    if not resume_text.strip():
        raise ValueError("Could not extract any text from the resume PDF.")

    # Output room sized to stay under the free-tier 8000 TPM limit while
    # still being enough to hold a full resume's structured JSON.
    llm = ChatGroq(model="openai/gpt-oss-120b", temperature=0, max_tokens=4000)
    agent = create_agent(model=llm, response_format=ExtractedResume)
    response = agent.invoke(
        {"messages": [{"role": "user", "content": EXTRACTION_PROMPT.format(resume_text=resume_text)}]}
    )
    return response["structured_response"]
