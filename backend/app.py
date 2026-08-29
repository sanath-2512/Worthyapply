"""
FastAPI backend for AI Job Application Copilot.

POST /api/analyze — accepts resume PDF + job description, returns full analysis.
GET  /api/health  — health check.
"""

import traceback

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .pipeline import run_full_pipeline, AnalysisResponse
from .resume_extractor import extract_resume, ExtractedResume

load_dotenv()

app = FastAPI(
    title="AI Job Application Copilot",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_JD_LENGTH = 50_000


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
):
    # Validate file type
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    if resume.content_type and resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Validate file size
    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # Validate job description
    job_description = job_description.strip()
    if not job_description:
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    if len(job_description) > MAX_JD_LENGTH:
        raise HTTPException(status_code=400, detail="Job description is too long.")

    # Run the pipeline
    try:
        result = run_full_pipeline(contents, job_description)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="An error occurred while analyzing your application. Please try again.",
        )

    return result


@app.post("/api/extract-resume", response_model=ExtractedResume)
async def extract_resume_endpoint(resume: UploadFile = File(...)):
    """Extract structured ResumeData from an uploaded resume PDF (V2 import flow)."""
    if not resume.filename or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    if resume.content_type and resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        result = extract_resume(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Could not read your resume. Please try again or build from scratch.",
        )

    return result
